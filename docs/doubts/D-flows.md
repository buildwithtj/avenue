# D-flows: doubts from building the six remaining-module flows (23 Nov 2026)

Built in Power Automate as `automations@` with a lean design (trigger + "Send an HTTP request to SharePoint", bodies from `addProperty`). All six are saved and On; trigger concurrency 1 on each. `[PROPOSED]` everywhere until the client answers.

1. **Reply in the same polling batch as the first message is refused.** Test: a new thread message and a reply to it created within seconds were handled in one batch; the reply ran first and got "Not accepted: that conversation was not found." A reply sent after the case exists works (tested). The portal only offers Reply on an existing thread, so this should not happen for members. Not fixed. Question: none for the client.
2. **Staff reply echo is not idempotent-guarded.** No "already echoed" marker, so any later edit of an Answered or Closed case re-writes the same Reply/Outcome (harmless) and re-runs the loop. No e-mail is sent. Same as the spec.
3. **Quote, notice and guest limits are the spec's `[PROPOSED]` values** (14 days notice, 1 to 60 guests, 1 to 20 storage units, member prices only). Event refusal needs an Active member row; automations@ was Active when tested, so the "membership must be active" refusal was NOT tested.
4. **Case rows get `Title` set to the case id on the support case only**; other case lists leave Title empty (SharePoint allows it). Staff screens must not rely on Title.
5. **Condition editor leaves an empty second row in the designer**; the saved code view shows a single clean condition (checked for flows 3 and 4 and by behaviour for all six). If someone re-opens a flow and saves, re-check the condition in code view.
6. **Decision flows trigger on any modification of a case row** (item modified, concurrency 1). They are idempotent: a repeat writes the same Outcome/Reply. Storage Approved without `MonthlyCents` echoes "$0.".
7. **Storage and event decision flows read the request by RequestId** (top 1). A case whose request was deleted does nothing (the condition checks the row exists).
8. **Flow checker shows a warning on the two copied flows (storage request, storage decision)** before first run; it did not stop saving or running. Not investigated further.
9. **Test rows were removed again by explicit id** (EventRequests 1-2, EventCases 1, StorageRequests 1-2, StorageCases 1, SupportMessages 1-4, SupportCases 1; all had `gaptest-` ids). Nothing left from this build.
10. **Sender of the REST test items was `automations@`**; no real member was used. A member who is not in AvenueMembers is refused for events and storage (the flow reads the member row).
