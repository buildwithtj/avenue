import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DisplayMode, Version } from '@microsoft/sp-core-library';
import { SPHttpClient, type SPHttpClientResponse } from '@microsoft/sp-http';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneToggle
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

import * as strings from 'AvenuePortalWebPartStrings';
import AvenuePortal, { type IAvenuePortalProps } from './components/AvenuePortal';
import type { IIntakeWriter } from '../../avenue/contracts';
import { userEmailOf } from '../../avenue/user';
import { DEMO_FACILITY_ID, demoFetchJson, demoWriter } from '../../avenue/demoData';
import { AvenueReadSource, type FetchJson, LISTS } from '../../avenue/readSource';
import { forceReleaseImmersive } from './immersive';

export interface IAvenuePortalWebPartProps {
  facilityId: string;
  useDemoData: boolean;
  staffUpload?: boolean;
  /** [PROPOSED] Hide the SharePoint header and left navigation. Unset (older pages) counts as on; only true full-screen in read mode. */
  immersive?: boolean;
}

export default class AvenuePortalWebPart extends BaseClientSideWebPart<IAvenuePortalWebPartProps> {

  private _root: Root | undefined;
  private _source: AvenueReadSource | undefined;
  private _sourceKey: string = '';

  public render(): void {
    const element: React.ReactElement<IAvenuePortalProps> = React.createElement(AvenuePortal, {
      source: this._getSource(),
      isDemo: !!this.properties.useDemoData,
      staffUpload: !!this.properties.staffUpload,
      // Never hide the page chrome while someone is editing the page, or they could not get back to the toolbar.
      immersive: this.properties.immersive !== false && this.displayMode === DisplayMode.Read,
      userDisplayName: this.context.pageContext.user.displayName,
      userEmail: userEmailOf(this.context.pageContext.user.email, this.context.pageContext.user.loginName)
    });

    if (!this._root) {
      this._root = createRoot(this.domElement);
    }

    this._root.render(element);
  }

  // Cached so re-renders (theme, property pane) do not refetch unless the configuration changed.
  private _getSource(): AvenueReadSource | undefined {
    const demo: boolean = !!this.properties.useDemoData;
    const facilityId: string = demo ? DEMO_FACILITY_ID : (this.properties.facilityId || '').trim();
    const key: string = `${demo}|${facilityId}`;
    if (key !== this._sourceKey) {
      this._sourceKey = key;
      try {
        this._source = new AvenueReadSource(
          this.context.pageContext.web.absoluteUrl,
          facilityId,
          demo ? demoFetchJson : this._spFetchJson,
          demo ? demoWriter : this._spWriter,
          demo ? undefined : this.context.pageContext.legacyPageContext.userId,
          demo ? undefined : userEmailOf(this.context.pageContext.user.email, this.context.pageContext.user.loginName)
        );
      } catch {
        this._source = undefined; // missing/invalid facility id: render "not configured"
      }
    }
    return this._source;
  }

  // Runs as the signed-in user; SharePoint list permissions decide what comes back.
  // Reads retry up to twice on throttling (429) or a busy server (503), honouring Retry-After (capped at 10 s).
  private _spFetchJson: FetchJson = (url: string) => {
    const attempt = (n: number): Promise<unknown> =>
      this.context.spHttpClient.get(url, SPHttpClient.configurations.v1).then((response: SPHttpClientResponse) => {
        if ((response.status === 429 || response.status === 503) && n < 2) {
          const wait: number = Math.min(10, Number(response.headers.get('Retry-After')) || 2 * (n + 1));
          return new Promise<unknown>(resolve => window.setTimeout(resolve, wait * 1000)).then(() => attempt(n + 1));
        }
        if (!response.ok) {
          throw new Error(`SharePoint returned ${response.status}.`);
        }
        return response.json();
      });
    return attempt(0);
  };

  // Writes to the member's own-items intake lists as the signed-in user. SharePoint records that user as the author,
  // which is the only identity the processing flows trust. List names come from LISTS constants, never from input.
  private _spWriter: IIntakeWriter = {
    add: (list: string, item: Record<string, unknown>) =>
      this._post(`${this._listUrl(list)}/items`, JSON.stringify(item), {})
        .then((response: SPHttpClientResponse) => response.json())
        .then((body: { Id?: unknown }) => {
          if (typeof body.Id !== 'number') {
            throw new Error('SharePoint did not return the new item.');
          }
          return body.Id;
        }),
    update: (list: string, id: number, fields: Record<string, unknown>) =>
      this._post(`${this._listUrl(list)}/items(${Math.trunc(id)})`, JSON.stringify(fields), { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' })
        .then(() => undefined),
    attach: (list: string, id: number, fileName: string, content: Blob) =>
      this._post(
        `${this._listUrl(list)}/items(${Math.trunc(id)})/AttachmentFiles/add(FileName='${encodeURIComponent(fileName.replace(/'/g, "''"))}')`,
        content, {}, true
      ).then(() => undefined)
  };

  private _listUrl(list: string): string {
    if (!Object.keys(LISTS).some(k => (LISTS as Record<string, string>)[k] === list)) {
      throw new Error('Avenue: unknown list.');
    }
    return `${this.context.pageContext.web.absoluteUrl}/_api/web/lists/getbytitle('${list}')`;
  }

  private _post(url: string, body: string | Blob, extraHeaders: Record<string, string>, binary: boolean = false): Promise<SPHttpClientResponse> {
    const headers: Record<string, string> = { Accept: 'application/json;odata=nometadata', ...extraHeaders };
    if (!binary) {
      headers['Content-Type'] = 'application/json;odata=nometadata';
    }
    return this.context.spHttpClient.post(url, SPHttpClient.configurations.v1, { headers, body })
      .then((response: SPHttpClientResponse) => {
        if (!response.ok) {
          throw new Error(`SharePoint returned ${response.status}.`);
        }
        return response;
      });
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (currentTheme?.semanticColors) {
      this.domElement.style.setProperty('--bodyText', currentTheme.semanticColors.bodyText || null);
    }
  }

  protected onDispose(): void {
    this._root?.unmount();
    this._root = undefined;
    forceReleaseImmersive(); // the component also releases on unmount; this guarantees the SharePoint chrome comes back

  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: strings.PropertyPaneDescription },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('facilityId', { label: strings.FacilityIdFieldLabel }),
                PropertyPaneToggle('useDemoData', { label: strings.UseDemoDataFieldLabel }),
                PropertyPaneToggle('staffUpload', { label: 'Staff page: upload documents for a member' }),
                PropertyPaneToggle('immersive', { label: 'Immersive mode (hide the SharePoint header and left navigation)', checked: this.properties.immersive !== false })
              ]
            }
          ]
        }
      ]
    };
  }
}
