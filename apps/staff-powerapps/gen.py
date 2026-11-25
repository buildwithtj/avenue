# NOTE: Category is a CHOICE on AvenueSupportCases/Messages until the R1 flow edit + Text conversion; code uses Category.Value. Switch back to Text then.
# Generates the staff-app screen YAML (pasted into Power Apps Studio). Run: python3 gen.py
# Formulas containing ": " or " #" are emitted as YAML block scalars, which Power Apps requires.
# NOTE: Category is a CHOICE on AvenueSupportCases/Messages until the R1 flow edit + Text conversion; code uses Category.Value. Switch back to Text then.
# Design system (shell, tokens, panels, chips, thumbnails) is defined once here; every screen uses these helpers.
import re, os, json
from release import *
FAC = '"flavors-hyattsville"'
S_FAC = 'LookUp(AvenueFacilities, FacilityId = ' + FAC + ')'

# ---------- Design tokens (define once) ----------
def _c(h, a=1):
    return f'RGBA({int(h[0:2], 16)},{int(h[2:4], 16)},{int(h[4:6], 16)},{a})'
INK, INK2, OLIVE = _c('0F4C5C'), _c('0B3A47'), _c('0F4C5C')          # Avenue teal (brand system, 18 Nov)
CREAM, SURFACE, CITRUS, CITRUS_DK = _c('F4F5F7'), _c('ffffff'), _c('C9A24D'), _c('B38D3C')   # gold = the one action colour
OK, OKTINT, OKTEXT = _c('0F4C5C'), _c('DCE8EB'), _c('0F4C5C')       # free / ok
BAD, BADTINT = _c('9B2C2C'), _c('F3E3E3')                           # error / taken
WAIT, WAITTINT = _c('6B4F10'), _c('F4EBD3')                         # waiting
MUTED, MUTEDTINT = _c('5B6370'), _c('E5E7EB')                       # cancelled / neutral
BORDER, TEXT, SUBTLE = _c('E1E4E9'), _c('1F1F1F'), _c('5B6370')
CLEAR = 'RGBA(0,0,0,0)'
GLASS, GLASS_EDGE = 'RGBA(255,255,255,0.64)', 'RGBA(15,76,92,0.10)'
GLASS_BAR = 'RGBA(11,58,71,0.93)'
GREY = SUBTLE
SEMI = 'FontWeight.Semibold'

# Owner logins (client sheet). Defined once; used by the owner override, Permissions and owner-only buttons.
OWNER_EMAILS = '["hyattsville@flavorsculinaryhub.com", "manage@appetitesbyrj.com"]'
def CAN(cap):
    """Staff capability toggle (AvenueStaffCapabilities, Permissions screen) for button Visible. USABILITY ONLY, NOT SECURITY:
    SharePoint still lets any staff account edit the lists; real enforcement is a flow/list-permission task (Q-15).
    No row for this e-mail = allowed (so the app works before the owner fills the list); the owner always sees everything."""
    return ('(Lower(User().Email) in ' + OWNER_EMAILS + ' || Coalesce(LookUp(AvenueStaffCapabilities, StaffEmail = Lower(User().Email)).' + cap + ', true))')
# The 11 document types (same choices as AvenueMemberDocuments.DocType in schema/lists.v2.json).
OWNER_SN_EARLY = 'Lower(User().Email) in ' + OWNER_EMAILS
DOC_TYPES = '["Permit", "Licence", "Insurance", "Certification", "County food permit", "MD good standing", "Liability insurance", "Workers comp or waiver", "Food safety manager", "Food manager card", "Food handler card"]'

# Optional per-section tweaks for top-level controls (used by the tabbed Setup screen): _DY shifts integer Y, _VIS adds a Visible formula.
_DY, _VIS = 0, None

_INPUT = {'BorderColor': BORDER, 'BorderThickness': 1, 'Color': TEXT, 'Fill': SURFACE}
_DEFAULTS = {'Classic/TextInput': _INPUT, 'Classic/DropDown': _INPUT, 'Classic/DatePicker': _INPUT}

def ctl(name, control, props, variant=None, children=None, indent=0):
    pad = ' ' * indent
    props = dict(props)
    for k, v in _DEFAULTS.get(control, {}).items(): props.setdefault(k, v)
    if indent == 0:
        if _DY and isinstance(props.get('Y'), int): props['Y'] += _DY
        if _VIS and 'Visible' not in props: props['Visible'] = _VIS
    out = [f'{pad}- {name}:', f'{pad}    Control: {control}']
    if variant: out.append(f'{pad}    Variant: {variant}')
    out.append(f'{pad}    Properties:')
    for k, v in props.items():
        v = str(v)
        f = v if v.startswith('=') else '=' + v
        if ': ' in f or ' #' in f or '\n' in f:
            out.append(f'{pad}      {k}: |-'); out += [f'{pad}        {line}' for line in f.split('\n')]
        else:
            out.append(f'{pad}      {k}: {f}')
    if children:
        out.append(f'{pad}    Children:')
        for c in children: out.append(c)
    return '\n'.join(out)

def label(name, text, x, y, w, h, **extra):
    p = {'Text': text, 'X': x, 'Y': y, 'Width': w, 'Height': h, 'Color': TEXT}; p.update(extra)
    return ctl(name, 'Label', p)

_RAD = {'RadiusTopLeft': 8, 'RadiusTopRight': 8, 'RadiusBottomLeft': 8, 'RadiusBottomRight': 8}
def button(name, text, x, y, w, h, onselect, **extra):
    """Primary (citrus) action button. Pass Fill/Color overrides for other roles; see button2 for the quiet variant."""
    p = {'Text': f'"{text}"', 'X': x, 'Y': y, 'Width': w, 'Height': h, 'OnSelect': onselect, 'Fill': CITRUS, 'Color': TEXT, 'HoverFill': CITRUS_DK, 'HoverColor': TEXT,
         'PressedFill': CITRUS_DK, 'DisabledFill': BORDER, 'DisabledColor': SUBTLE, 'BorderThickness': 0, 'Size': 12, 'FontWeight': SEMI}
    p.update(_RAD); p.update(extra)
    return ctl(name, 'Classic/Button', p)

def button2(name, text, x, y, w, h, onselect, **extra):
    """Quiet button: white with an olive outline."""
    p = {'Fill': SURFACE, 'Color': OLIVE, 'HoverFill': CREAM, 'HoverColor': OLIVE, 'PressedFill': MUTEDTINT, 'BorderColor': OLIVE, 'HoverBorderColor': OLIVE, 'PressedBorderColor': OLIVE,
         'BorderThickness': 1, 'DisabledBorderColor': BORDER}
    p.update(extra)
    return button(name, text, x, y, w, h, onselect, **p)

def panel(name, x, y, w, h, fill=GLASS, radius=14, **extra):
    """White card with a soft border and radius: a disabled button with no text (Label has no radius)."""
    p = {'Text': '""', 'X': x, 'Y': y, 'Width': w, 'Height': h, 'DisplayMode': 'DisplayMode.Disabled', 'Fill': fill, 'DisabledFill': fill, 'DisabledColor': fill,
         'BorderColor': GLASS_EDGE, 'DisabledBorderColor': GLASS_EDGE, 'BorderThickness': 1,
         'RadiusTopLeft': radius, 'RadiusTopRight': radius, 'RadiusBottomLeft': radius, 'RadiusBottomRight': radius}
    p.update(extra)
    return ctl(name, 'Classic/Button', p)

def head(name, text, x, y, w, size=16, **extra):
    p = {'Size': size, 'FontWeight': 'FontWeight.Bold', 'Color': INK}; p.update(extra)
    return label(name, text, x, y, w, size + 14, **p)

def hint(name, text, x, y, w, h=24, **extra):
    p = {'Size': 11, 'Color': SUBTLE}; p.update(extra)
    return label(name, text, x, y, w, h, **p)

def chip_props(text, fill, color, x, y, w, h=24):
    return {'Text': text, 'X': x, 'Y': y, 'Width': w, 'Height': h, 'DisplayMode': 'DisplayMode.Disabled', 'Fill': fill, 'DisabledFill': fill, 'DisabledColor': color,
            'Color': color, 'BorderThickness': 0, 'Size': 10, 'FontWeight': 'FontWeight.Bold', 'RadiusTopLeft': 12, 'RadiusTopRight': 12, 'RadiusBottomLeft': 12, 'RadiusBottomRight': 12}

def status_chip(name, status, x, y, w=128, h=24):
    """Booking status chip, same wording and colours as the member portal stamp: Waiting / Approved / Declined / Cancelled.
    `status` is a Power Fx expression for the status text. Returns a gallery-child tuple (use ctl(*chip) at top level)."""
    t = f'Switch({status}, "Pending", "Waiting", "Approved", "Approved", "Declined", "Declined", "Cancelled", "Cancelled", {status})'
    fill = f'Switch({status}, "Pending", {WAITTINT}, "Approved", {OKTINT}, "Declined", {BADTINT}, {MUTEDTINT})'
    col = f'Switch({status}, "Pending", {WAIT}, "Approved", {OKTEXT}, "Declined", {BAD}, {MUTED})'
    return (name, 'Classic/Button', chip_props(t, fill, col, x, y, w, h))

def pill(name, text, fill, color, x, y, w, h=24):
    return (name, 'Classic/Button', chip_props(text, fill, color, x, y, w, h))

# ---------- Equipment thumbnails ----------
GLYPH = 'If(IsBlank({c}), "-", Upper(Left({c}, 1)))'
def thumb(name, photo, cat, x, y, size):
    """Small picture of a unit: its PhotoUrl when present, else a neutral tile with an emoji by category. Returns two gallery-child tuples."""
    return [(name + 'Img', 'Image', {'Image': f'If(!IsBlank({photo}), {photo}, Blank())', 'Visible': f'!IsBlank({photo})', 'X': x, 'Y': y, 'Width': size, 'Height': size}),
            (name + 'Tile', 'Label', {'Text': GLYPH.format(c=cat), 'Visible': f'IsBlank({photo})', 'X': x, 'Y': y, 'Width': size, 'Height': size, 'Fill': MUTEDTINT, 'Color': OLIVE,
                                      'Size': max(12, size // 2), 'Align': 'Align.Center', 'VerticalAlign': 'VerticalAlign.Middle'})]

# ---------- Facility (Eastern) time helpers ----------
# Offset rule copied from EPERIOD (DST: second Sunday of March to first Sunday of November).
DST_UTC = 'u >= DateAdd(DateAdd(m3, Mod(8 - Weekday(m3), 7) + 7, TimeUnit.Days), 7, TimeUnit.Hours) && u < DateAdd(DateAdd(n11, Mod(8 - Weekday(n11), 7), TimeUnit.Days), 6, TimeUnit.Hours)'
def f_local(expr, fmt):
    """Text of an instant in facility (Eastern) time, whatever the device time zone."""
    return ('With({t: ' + expr + '}, If(IsBlank(t), "Time unavailable", With({u: DateAdd(t, TimeZoneOffset(t), TimeUnit.Minutes)}, With({m3: Date(Year(u), 3, 1), n11: Date(Year(u), 11, 1)}, '
            'Text(DateAdd(u, -If(' + DST_UTC + ', 4, 5), TimeUnit.Hours), "' + fmt + '")))))')
def f_day_start(d):
    """The instant of 00:00 facility time on calendar day d (a date value), as a date-time comparable with StartUtc/EndUtc."""
    return ('With({dd: Coalesce(' + d + ', Today())}, With({d0: Date(Year(dd), Month(dd), Day(dd))}, With({m3: Date(Year(d0), 3, 1), n11: Date(Year(d0), 11, 1)}, '
            'DateAdd(d0, If(d0 > DateAdd(m3, Mod(8 - Weekday(m3), 7) + 7, TimeUnit.Days) && d0 <= DateAdd(n11, Mod(8 - Weekday(n11), 7), TimeUnit.Days), 4, 5) * 60 - TimeZoneOffset(d0), TimeUnit.Minutes))))')
def _east(start, inner):
    """Run `inner` (Power Fx using the Eastern shift k, in minutes, of `start`) once per cell instead of once per time shown."""
    return ('With({s0: ' + start + '}, If(IsBlank(s0), "Time unavailable", With({u: DateAdd(s0, TimeZoneOffset(s0), TimeUnit.Minutes)}, With({m3: Date(Year(u), 3, 1), n11: Date(Year(u), 11, 1)}, '
            'With({k: TimeZoneOffset(s0) - If(' + DST_UTC + ', 4, 5) * 60}, ' + inner + ')))))')
def _t(x, plus='', fmt='h:mm AM/PM'):
    return 'Text(DateAdd(' + x + ', k' + plus + ', TimeUnit.Minutes), "' + fmt + '")'
def f_window(start, end, short=False, who=None):
    """'In from <start - EarlyEntryMinutes> · Booked <start>–<end> · Clean-up until <end + CleanupMinutes>' in Eastern time, using the facility row.
    EarlyEntryMinutes and CleanupMinutes come from AvenueFacilities (Setup > Facility rules); an empty value counts as 0."""
    inner = ('"In from " & ' + _t('s0', ' - Coalesce(f.EarlyEntryMinutes, 0)') + ' & " · ' + ('' if short else 'Booked " & ' + _t('s0') + ' & "–" & ' + _t(end) + ' & " · ') +
             'Clean-up until " & ' + _t(end, ' + Coalesce(f.CleanupMinutes, 0)'))
    return 'With({f: ' + S_FAC + '}, ' + _east(start, inner) + ')'
def f_when(start, end):
    """'Wed 19 Nov · 3:00 PM–6:00 PM' in Eastern time."""
    return _east(start, _t('s0', fmt='ddd d mmm') + ' & " · " & ' + _t('s0') + ' & "–" & ' + _t(end))

def conflicts(s, e, ids, fac=FAC, exclude=None):
    """Approved bookings that overlap [s, e) and hold any of the equipment ids (a table with a Value column, e.g. Split(...)).
    This is the one availability rule shared by Requests (blocks Approve) and Book (blocks Book). Touching times do not overlap."""
    ex = f', BookingId <> {exclude}' if exclude else ''
    return (f'Filter(Filter(AvenueBookings, FacilityId = {fac}, Status.Value = "Approved"{ex}, StartUtc < {e}, EndUtc > {s}) As b, '
            f'CountRows(Filter(Split(b.EquipmentIds, ";"), Trim(Value) in {ids})) > 0)')
def conflict_msg(conf, ids, prefix=''):
    """Reason text: '<unit> is booked by <name> until <time>' for the first conflict, plus '(and N more)'."""
    return ('With({c: First(' + conf + ')}, Concat(Filter(Split(c.EquipmentIds, ";"), Trim(Value) in ' + ids + '), Coalesce(LookUp(AvenueEquipment, EquipmentId = Trim(Value)).Title, Trim(Value)), ", ") & " is booked by " & '
            'Coalesce(LookUp(AvenueCalendar, BookingId = c.BookingId).MemberDisplayName, c.MemberId) & " until " & ' + f_local('c.EndUtc', 'h:mm AM/PM') + ')')

# ---------- App shell: dark top bar, primary navigation (grouped), tab row for groups with several screens ----------
def group_of(screen):
    for g, items in primary_nav():
        if any(s == screen for _, s in items): return g, items
    return ('More', []) if HUB_ON else (None, [])
def cy(screen):
    """Content top (y) on this screen: below the top bar, and below the tab row when its group has several screens."""
    return 88 if len(group_of(screen)[1]) > 1 else 64

_NAVN = None
BACKDROP = """"data:image/svg+xml;utf8," & EncodeUrl("<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='1000' viewBox='0 0 1600 1000' preserveAspectRatio='none'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#E3ECEF'/><stop offset='1' stop-color='#F6F7F9'/></linearGradient><filter id='b' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='90'/></filter></defs><rect width='1600' height='1000' fill='url(#g)'/><circle cx='240' cy='200' r='270' fill='#0F4C5C' fill-opacity='0.26' filter='url(#b)'/><circle cx='1400' cy='240' r='230' fill='#C9A24D' fill-opacity='0.30' filter='url(#b)'/><circle cx='880' cy='920' r='310' fill='#0F4C5C' fill-opacity='0.15' filter='url(#b)'/></svg>")"""
def nav(prefix, current, title):
    g, items = group_of(current)
    P = primary_nav()
    R = lambda x: f'App.Width - {1366 - x}'
    parts = [ctl(f'{prefix}Bg', 'Image', {'Image': BACKDROP, 'X': 0, 'Y': 0, 'Width': 'App.Width', 'Height': 'App.Height', 'ImagePosition': 'ImagePosition.Fill'}),
             label(f'{prefix}Bar', '""', 0, 0, 1366, 48, Fill=GLASS_BAR, Width='App.Width'),
             label(f'{prefix}BarEdge', '""', 0, 47, 1366, 1, Fill='RGBA(255,255,255,0.14)', Width='App.Width'),
             label(f'{prefix}Dot', '"◆"', 20, 0, 20, 48, Size=14, Color=CITRUS, VerticalAlign='VerticalAlign.Middle'),
             label(f'{prefix}Brand', '"Avenue · Flavors"', 40, 0, 200, 48, Size=16, FontWeight='FontWeight.Bold', Color=CREAM, VerticalAlign='VerticalAlign.Middle'),
             label(f'{prefix}Title', f'"{title}"', 232, 0, 380, 48, Size=13, Color='RGBA(255,255,255,0.62)', VerticalAlign='VerticalAlign.Middle')]
    bw, gap = 104, 4
    x = 1342 - len(P) * (bw + gap) + gap
    pill_r = dict(RadiusTopLeft=16, RadiusTopRight=16, RadiusBottomLeft=16, RadiusBottomRight=16)
    for text, its in P:
        on_ = text == g
        parts.append(button(f'{prefix}Nav{re.sub("[^A-Za-z]", "", text)}', text, x, 8, bw, 32, f'Navigate({its[0][1]})', X=R(x),
                            Fill='RGBA(255,255,255,0.20)' if on_ else CLEAR, Color='RGBA(255,255,255,1)' if on_ else 'RGBA(255,255,255,0.72)',
                            HoverFill='RGBA(255,255,255,0.14)', HoverColor='RGBA(255,255,255,1)', PressedFill='RGBA(255,255,255,0.26)', Size=12,
                            FontWeight='FontWeight.Bold' if on_ else 'FontWeight.Normal', **pill_r))
        if on_: parts.append(label(f'{prefix}NavLine', '""', x + 30, 43, bw - 60, 3, Fill=CITRUS, X=R(x + 30)))
        x += bw + gap
    if len(items) > 1:
        parts.append(label(f'{prefix}TabBar', '""', 0, 48, 1366, 32, Fill='RGBA(255,255,255,0.58)', Width='App.Width'))
        parts.append(label(f'{prefix}TabEdge', '""', 0, 80, 1366, 1, Fill=GLASS_EDGE, Width='App.Width'))
        tx = 24
        for text, scr in items:
            on_ = scr == current
            parts.append(button(f'{prefix}Tab{re.sub("[^A-Za-z]", "", text)}', text, tx, 52, 104, 24, f'Navigate({scr})', Fill='RGBA(15,76,92,0.10)' if on_ else CLEAR,
                                Color=OLIVE if on_ else SUBTLE, HoverFill='RGBA(15,76,92,0.07)', HoverColor=OLIVE, PressedFill='RGBA(15,76,92,0.14)', Size=12,
                                FontWeight='FontWeight.Bold' if on_ else 'FontWeight.Normal', **pill_r))
            tx += 108
    global _NAVN
    _NAVN = len(parts)
    return parts

def gallery(name, items, x, y, w, h, tsize, children, **extra):
    p = {'Items': items, 'X': x, 'Y': y, 'Width': w, 'Height': h, 'TemplateSize': tsize, 'Fill': CLEAR, 'BorderThickness': 0,
         'TemplateFill': f'If(ThisItem.IsSelected, {_c("f1f3e4")}, {CLEAR})'}; p.update(extra)
    kids = [ctl(*c, indent=6) if isinstance(c, tuple) else c for c in children]
    kids.append(ctl(name + 'Sep', 'Label', {'Text': '""', 'X': 8, 'Y': tsize - 1, 'Width': max(40, w - 32), 'Height': 1, 'Fill': BORDER}, indent=6))
    return ctl(name, 'Gallery@2.15.0', p, variant='BrowseLayout_Vertical_TwoTextOneImageVariant_ver5.0', children=kids)

def child(name, text, x, y, w, h, **extra):
    p = {'Text': text, 'X': x, 'Y': y, 'Width': w, 'Height': h, 'Color': TEXT}; p.update(extra)
    return (name, 'Label', p)

def write(fname, parts):
    key = fname.replace('.pa.yaml', '')
    if not on(FILE_MODULE.get(key)) or (key == 'more' and not HUB_ON):
        if os.path.exists(os.path.join('screens', fname)): os.remove(os.path.join('screens', fname))
        return
    global _NAVN
    if _NAVN is not None and len(parts) > _NAVN and key not in ('approved-extensions',):
        top = 88 if any(('TabBar' in p.split('\n')[0]) for p in parts[:_NAVN]) else 64
        shell, body = parts[:_NAVN], parts[_NAVN:]
        shifted, bottom = [], 0
        for p in body:
            ys = re.search(r'^      Y: =(\d+)$', p, re.M); hs = re.search(r'^      Height: =(\d+)$', p, re.M)
            if ys:
                p = re.sub(r'^      Y: =(\d+)$', lambda m: '      Y: =' + str(int(m.group(1)) - top), p, count=1, flags=re.M)
                if hs: bottom = max(bottom, int(ys.group(1)) - top + int(hs.group(1)))
            shifted.append('\n'.join('        ' + ln for ln in p.split('\n')))
        H = max(768 - top, bottom + 32)
        tm = 'tm_' + key.replace('-', '_')
        wrap = ['- sc_' + key.replace('-', '_') + ':', '    Control: GroupContainer@1.3.0', '    Variant: AutoLayout', '    Properties:',
                '      X: =0', f'      Y: ={top}', '      Width: =App.Width', f'      Height: =App.Height - {top}', '      Fill: =RGBA(0, 0, 0, 0)',
                f'      PaddingTop: =Round((1 - Min(1, {tm}.Value / 420)) * 22, 0)', '      LayoutAlignItems: =LayoutAlignItems.Center',
                '      LayoutDirection: =LayoutDirection.Vertical', '      LayoutOverflowY: =LayoutOverflow.Scroll', '      DropShadow: =DropShadow.None',
                '    Children:', '    - pg_' + key.replace('-', '_') + ':', '        Control: GroupContainer@1.3.0', '        Variant: ManualLayout', '        Properties:',
                f'          Height: ={H}', '          Width: =1366', '          AlignInContainer: =AlignInContainer.Center', '          FillPortions: =0', '          Fill: =RGBA(0, 0, 0, 0)', '          DropShadow: =DropShadow.None',
                '        Children:'] + shifted
        timer = ctl(tm, 'Timer', {'Duration': 420, 'AutoStart': 'true', 'Repeat': 'false', 'Visible': 'false', 'X': 0, 'Y': 0, 'Width': 10, 'Height': 10})
        parts = shell + [timer, '\n'.join(wrap)]
    _NAVN = None
    text = '\n'.join(parts) + '\n'
    # A link to a screen outside this release becomes a no-op, so nothing points at a missing screen.
    text = re.sub(r'Navigate\((Screen\d+)\)', lambda m: m.group(0) if m.group(1) in screens_on() else 'false', text)
    open(os.path.join('screens', fname), 'w', encoding='utf-8').write(text)

# Open follow-ups. The inner Filter is delegable and small (started/ended recently); blank checks run locally on it.
MISSED_ITEMS = 'Filter(Filter(AvenueBookings, Status.Value = "Approved", StartUtc <= Now(), EndUtc >= DateAdd(Now(), -12, TimeUnit.Hours)) As b, !IsBlank(b.MissedCheckInAt) && IsBlank(b.OutreachAt) && IsBlank(LookUp(AvenueCheckIns, BookingId = b.BookingId && Kind.Value = "Entry")))'
EXITS_ITEMS = 'Filter(Filter(AvenueBookings, Status.Value = "Approved", EndUtc <= Now(), EndUtc >= DateAdd(Now(), -24, TimeUnit.Hours)) As b, !IsBlank(b.ExitFlaggedAt) && IsBlank(b.ExitOutreachAt) && IsBlank(LookUp(AvenueCheckIns, BookingId = b.BookingId && Kind.Value = "Exit")))'
MISSED_COUNT = f'CountRows({MISSED_ITEMS})'
EXITS_COUNT = f'CountRows({EXITS_ITEMS})'

# Facility (Eastern) month as "yyyy-mm", independent of the device time zone (DECISION_LOG 2026-11-12). DST: second Sunday of March
# 07:00 UTC to first Sunday of November 06:00 UTC. Wrapped in With() by callers so the Filter below it stays delegable.
EPERIOD = ('With({u: DateAdd(Now(), TimeZoneOffset(Now()), TimeUnit.Minutes)}, With({m3: Date(Year(u), 3, 1), n11: Date(Year(u), 11, 1)}, '
           'Text(DateAdd(u, -If(u >= DateAdd(DateAdd(m3, Mod(8 - Weekday(m3), 7) + 7, TimeUnit.Days), 7, TimeUnit.Hours) && u < DateAdd(DateAdd(n11, Mod(8 - Weekday(n11), 7), TimeUnit.Days), 6, TimeUnit.Hours), 4, 5), TimeUnit.Hours), "yyyy-mm")))')


# ---------- Dashboard (Screen3) ----------
monthHours = 'With({p: ' + EPERIOD + '}, Coalesce(Sum(Filter(AvenueHoursLedger, Period = p), Hours), 0))'
Y0 = cy('Screen3')
# KPI strip. [PROPOSED] windows: "starting soon" = within 2 hours; "ending soon" = within the facility's CheckoutAlertMinutes (empty = 0).
ENDM = 'Coalesce(' + S_FAC + '.CheckoutAlertMinutes, 0)'
PENDING_CONFLICTS = 'CountRows(Filter(Filter(AvenueBookings, Status.Value = "Pending") As p, CountRows(' + conflicts('p.StartUtc', 'p.EndUtc', 'Split(p.EquipmentIds, ";")') + ') > 0))'
kpis = [
    ('Waiting for approval', 'CountRows(Filter(AvenueBookings, Status.Value = "Pending"))', '"requests to decide"', 'Screen1', INK),
    ('Conflicts', PENDING_CONFLICTS, '"pending requests that clash"', 'Screen1', None),
    ('Starting soon', 'CountRows(Filter(AvenueBookings, Status.Value = "Approved", StartUtc >= Now(), StartUtc <= DateAdd(Now(), 2, TimeUnit.Hours)))', '"approved, within 2 hours"', 'Screen19', INK),
    ('Ending soon', 'CountRows(Filter(AvenueBookings, Status.Value = "Approved", StartUtc <= Now(), EndUtc >= Now(), EndUtc <= DateAdd(Now(), ' + ENDM + ', TimeUnit.Minutes)))', '"in progress, ending within " & ' + ENDM + ' & " min"', 'Screen2', INK)]
parts = nav('d', 'Screen3', 'Dashboard')
for i, (cap, val, sub, target, colr) in enumerate(kpis):
    x = 24 + i * 332
    parts.append(button(f'dKpi{i}', '', x, Y0, 316, 104, f'Navigate({target})', Fill=GLASS, HoverFill='RGBA(255,255,255,0.86)', PressedFill=MUTEDTINT, BorderColor=GLASS_EDGE, HoverBorderColor=OLIVE, BorderThickness=1, Text='""', RadiusTopLeft=14, RadiusTopRight=14, RadiusBottomLeft=14, RadiusBottomRight=14))
    parts.append(label(f'dKpiCap{i}', f'"{cap}"', x + 20, Y0 + 12, 276, 24, Size=12, FontWeight='FontWeight.Bold', Color=SUBTLE, OnSelect=f'Navigate({target})'))
    parts.append(label(f'dKpiVal{i}', val, x + 20, Y0 + 36, 276, 44, Size=32, FontWeight='FontWeight.Bold',
                       Color=colr or f'If(Value(Self.Text) > 0, {BAD}, {OKTEXT})', OnSelect=f'Navigate({target})'))
    parts.append(label(f'dKpiSub{i}', sub, x + 20, Y0 + 76, 276, 22, Size=11, Color=SUBTLE, OnSelect=f'Navigate({target})'))
# Operations panel: the other counters, one row each.
ops = [
    ('Approved, next 7 days', 'CountRows(Filter(AvenueBookings, Status.Value = "Approved", StartUtc >= Now(), StartUtc <= DateAdd(Now(), 7, TimeUnit.Days)))', 'Screen2'),
    ('Asked to cancel (under 24 h)', 'CountRows(Filter(AvenueBookings, Status.Value = "Approved", !IsBlank(CancelRequestedAt)))', 'Screen2'),
    ('Hours used this month', f'Text(Round({monthHours}, 1))', 'Screen3'),
    ('Documents expired (not renewed)', 'CountRows(Filter(AvenueMemberDocuments, DocStatus.Value = "Expired", IsBlank(SupersededBy)))', 'Screen4'),
    ('Documents expiring (30 days)', 'CountRows(Filter(AvenueMemberDocuments, DocStatus.Value = "Expiring", IsBlank(SupersededBy)))', 'Screen4'),
    ('Documents to verify', 'CountRows(Filter(AvenueMemberDocuments, Verified = false))', 'Screen4'),
    ('Failed checklists to follow up (7 days)', 'CountRows(Filter(AvenueCheckIns, AllPassed = false, IsBlank(ResolvedAt), SubmittedAt >= DateAdd(Now(), -7, TimeUnit.Days)))', 'Screen5'),
    ('Missed entry checklists, open', MISSED_COUNT, 'Screen5'),
    ('Exit checklists overdue, open', EXITS_COUNT, 'Screen5'),
    ('Compliance cases to review', 'CountRows(Filter(AvenueComplianceCases, FacilityId = ' + FAC + ', Status.Value = "Open"))', 'Screen4'),
    ('Booking holds active', 'CountRows(Filter(AvenueComplianceCases, FacilityId = ' + FAC + ', Active = true))', 'Screen4'),
    ('Active members', 'CountRows(Filter(AvenueMembers, FacilityId = ' + FAC + ', Status.Value = "Active"))', 'Screen8'),
    ('Applicants waiting (onboarding or invite)', 'CountRows(Filter(AvenueApplicants, FacilityId = ' + FAC + ', Stage.Value = "Onboarding" || Stage.Value = "InviteNeeded"))', 'Screen16'),
    ('Invoices overdue', 'CountRows(Filter(AvenueInvoices, FacilityId = ' + FAC + ', Status.Value = "open", DueDate < Today()))', 'Screen13'),
    ('Staff alert e-mail', 'If(IsBlank(' + S_FAC + '.StaffAlertEmail), "Not set", "Set")', 'Screen10'),
]
parts.append(panel('dPanelOps', 24, Y0 + 120, 640, 52 + 32 * len(ops) + 8))
parts.append(head('dOpsHead', '"Operations"', 44, Y0 + 130, 400))
for i, (cap, val, target) in enumerate(ops):
    y = Y0 + 120 + 52 + i * 32
    parts.append(button(f'dOp{i}', '', 32, y, 624, 32, f'Navigate({target})', Fill=CLEAR, HoverFill=_c('f1f3e4'), PressedFill=MUTEDTINT, BorderThickness=0, Text='""', RadiusTopLeft=6, RadiusTopRight=6, RadiusBottomLeft=6, RadiusBottomRight=6))
    parts.append(label(f'dOpCap{i}', f'"{cap}"', 44, y + 4, 440, 24, Size=12, OnSelect=f'Navigate({target})'))
    parts.append(label(f'dOpVal{i}', val, 500, y + 4, 148, 24, Size=13, FontWeight='FontWeight.Bold', Align='Align.Right', OnSelect=f'Navigate({target})'))
yb = Y0 + 120 + 52 + 32 * len(ops) + 24
parts.append(button('dRefresh', 'Refresh data', 24, yb, 160, 40,
    'Refresh(AvenueBookings); Refresh(AvenueHoursLedger); Refresh(AvenueMemberDocuments); Refresh(AvenueCheckIns); Refresh(AvenueMembers); Refresh(AvenueFacilities); Refresh(AvenuePlans); Refresh(AvenueApplicants); Refresh(AvenueInvoices); Set(varRefreshed, Now())'))
parts.append(label('dRefreshed', '"Figures as of " & If(IsBlank(varRefreshed), "when the app was opened (press Refresh data to update)", Text(varRefreshed, "h:mm:ss AM/PM"))', 196, yb + 8, 468, 24, Size=11, Color=SUBTLE))
parts.append(panel('dPanelHours', 680, Y0 + 120, 662, 200))
parts.append(head('dHoursHead', '"Hours used this month, by member"', 700, Y0 + 130, 620))
parts.append(gallery('dHoursGal',
    'With({p: ' + EPERIOD + '}, SortByColumns(AddColumns(GroupBy(Filter(AvenueHoursLedger, Period = p), MemberId, Rows), Total, Sum(Rows, Hours)), "Total", SortOrder.Descending))',
    688, Y0 + 172, 646, 140, 40,
    [child('dHoursMember', 'Coalesce(LookUp(AvenueMembers, MemberId = ThisItem.MemberId).BusinessName, If(IsBlank(Find("@", ThisItem.MemberId)), ThisItem.MemberId, Left(ThisItem.MemberId, Find("@", ThisItem.MemberId) - 1)))', 8, 6, 330, 28),
     child('dHoursTotal', 'Text(Round(ThisItem.Total, 1)) & " h"', 340, 6, 90, 28, Align='Align.Right'),
     child('dHoursOver', 'With({pl: LookUp(AvenuePlans, PlanId = LookUp(AvenueMembers, MemberId = ThisItem.MemberId).PlanId)}, If(IsBlank(pl), "plan hours not set", If(ThisItem.Total > pl.MonthlyHours, "about " & Text(Round(ThisItem.Total - pl.MonthlyHours, 1)) & " h over", "within plan")))', 440, 6, 190, 28, Size=11,
           Color=f'If(Right(Self.Text, 4) = "over", {BAD}, {SUBTLE})')]))
parts.append(panel('dPanelEq', 680, Y0 + 336, 662, 52 + 32 * len(ops) + 8 - 216))
parts.append(head('dEquipHead', '"Equipment, booked hours this month"', 700, Y0 + 346, 620))
# Inner Filter (delegable) = approved bookings this month; the substring match on EquipmentIds runs locally on that set.
parts.append(gallery('dEquipGal',
    'ForAll(Filter(AvenueEquipment, FacilityId = ' + FAC + ', Active = true) As q, {Id: q.EquipmentId, Name: q.Title, Cat: q.Category.Value, Photo: q.PhotoUrl, Hours: Sum(Filter(Filter(AvenueBookings, Status.Value = "Approved", StartUtc >= DateValue(Text(Today(), "yyyy-mm") & "-01")), q.EquipmentId in EquipmentIds), DateDiff(StartUtc, EndUtc, TimeUnit.Minutes) / 60)})',
    688, Y0 + 388, 646, 52 + 32 * len(ops) + 8 - 216 - 60, 40,
    thumb('dEq', 'ThisItem.Photo', 'ThisItem.Cat', 8, 6, 28) +
    [child('dEquipId', 'ThisItem.Name', 48, 6, 400, 28), child('dEquipHours', 'Text(Round(ThisItem.Hours, 1)) & " h"', 460, 6, 170, 28, Align='Align.Right')]))
parts.append(hint('dNote', '"Overage is shown in hours (hours used minus the plan\'s monthly hours), an estimate. Money amounts need the extra-hour rate (Q-04) and Stripe. Month = facility (Eastern) month."', 24, yb + 48, 640, 40))
# ---- Recent requests (order-list style) ----
YR = max(Y0 + 692, yb + 100)
parts.append(panel('dPanelRecent', 24, YR, 1318, 60 + 9 * 46 + 12))
parts.append(head('dRecentHead', '"Recent requests"', 44, YR + 12, 600))
parts.append(hint('dRecentSub', '"Latest 8 by request time. Select Bookings to decide or review."', 700, YR + 16, 620, 24, Align='Align.Right'))
parts.append(label('dRecCol0', '"MEMBER"', 52, YR + 52, 260, 20, Size=10, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(label('dRecCol1', '"WHEN (EASTERN)"', 332, YR + 52, 300, 20, Size=10, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(label('dRecCol2', '"SPACE"', 652, YR + 52, 160, 20, Size=10, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(label('dRecCol3', '"STATUS"', 832, YR + 52, 160, 20, Size=10, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(gallery('dRecentGal', 'FirstN(SortByColumns(AvenueBookings, "RequestedAt", SortOrder.Descending), 8)', 32, YR + 76, 1294, 8 * 46, 46,
    [child('dRecMember', 'Coalesce(LookUp(AvenueMembers, MemberId = ThisItem.MemberId).BusinessName, ThisItem.MemberId)', 12, 10, 270, 26, Size=13, FontWeight='FontWeight.Semibold'),
     child('dRecWhen', f_when('ThisItem.StartUtc', 'ThisItem.EndUtc'), 300, 10, 300, 26, Size=12),
     child('dRecSpace', 'If(ThisItem.Space.Value = "Whole facility", "Whole kitchen", ThisItem.Space.Value)', 620, 10, 160, 26, Size=12),
     status_chip('dRecChip', 'ThisItem.Status.Value', 800, 11, 140, 24)]))
write('dashboard.pa.yaml', parts)

# ---------- Insights (Screen20): native analytics, no extra licence. Power BI for B Street: docs/POWER_BI.md ----------
Y1 = cy('Screen20')
parts = nav('ix', 'Screen20', 'Insights')
bar = lambda n, mx, w: f'Max(4, Min({w}, ThisItem.N * {w} / Max(1, {mx})))'
MS = 'Date(Year(Today()), Month(Today()), 1)'
NM = 'DateAdd(' + MS + ', 1, TimeUnit.Months)'
MONTH_APPROVED = 'Filter(AvenueBookings, Status.Value = "Approved", StartUtc >= ' + MS + ', StartUtc < ' + NM + ')'
ACTIVE_M = 'Filter(AvenueMembers, FacilityId = ' + FAC + ', Status.Value = "Active")'
PLAN_H = 'Sum(ForAll(' + ACTIVE_M + ' As m, {V: Coalesce(LookUp(AvenuePlans, PlanId = m.PlanId).MonthlyHours, 0)}), V)'
def cnt(st): return 'CountRows(Filter(AvenueBookings, Status.Value = "' + st + '"))'
ik = [
    ('Approved, next 7 days', 'CountRows(Filter(AvenueBookings, Status.Value = "Approved", StartUtc >= Now(), StartUtc <= DateAdd(Now(), 7, TimeUnit.Days)))', 'upcoming'),
    ('Waiting for approval', cnt('Pending'), 'requests to decide'),
    ('Bookings this month', 'CountRows(' + MONTH_APPROVED + ')', 'approved, facility month'),
    ('Hours used this month', f'Text(Round({monthHours}, 1)) & " h"', 'all members'),
    ('Plan hours available', 'Text(' + PLAN_H + ') & " h"', 'active members, per month'),
    ('Utilisation', 'With({ph: ' + PLAN_H + '}, If(ph = 0, "n/a", Text(Round(100 * ' + monthHours + ' / ph, 0)) & "%"))', 'hours used / plan hours'),
    ('Active members', 'CountRows(' + ACTIVE_M + ')', 'on a plan today'),
    ('Members who booked', 'With({p: ' + EPERIOD + '}, Text(CountRows(GroupBy(Filter(AvenueHoursLedger, Period = p), MemberId, Rows))) & " of " & Text(CountRows(' + ACTIVE_M + ')))', 'this month'),
    ('Average booking', 'With({r: ' + MONTH_APPROVED + '}, If(CountRows(r) = 0, "n/a", Text(Round(Sum(r, DateDiff(StartUtc, EndUtc, TimeUnit.Minutes)) / 60 / CountRows(r), 1)) & " h"))', 'length this month'),
    ('Approval rate', 'With({a: ' + cnt('Approved') + ', d: ' + cnt('Declined') + '}, If(a + d = 0, "n/a", Text(Round(100 * a / (a + d), 0)) & "%"))', 'approved of decided'),
    ('Cancel rate', 'With({a: CountRows(AvenueBookings), d: ' + cnt('Cancelled') + '}, If(a = 0, "n/a", Text(Round(100 * d / a, 0)) & "%"))', 'of all requests'),
    ('Late cancel requests', 'CountRows(Filter(AvenueBookings, !IsBlank(CancelRequestedAt)))', 'under 24 h, to decide')]
for i, (cap, val, sub) in enumerate(ik):
    x = 24 + (i % 6) * 222
    y = Y1 + (i // 6) * 96
    parts.append(panel(f'ixKpiP{i}', x, y, 208, 84))
    parts.append(label(f'ixKpiCap{i}', f'"{cap}"', x + 14, y + 8, 182, 18, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE))
    parts.append(label(f'ixKpiVal{i}', val, x + 14, y + 26, 182, 34, Size=24, FontWeight='FontWeight.Bold', Color=INK))
    parts.append(label(f'ixKpiSub{i}', f'"{sub}"', x + 14, y + 62, 182, 16, Size=10, Color=SUBTLE))
Y2 = Y1 + 192 + 12
PH = 232
parts.append(panel('ixPanelWeek', 24, Y2, 640, PH))
parts.append(head('ixWeekHead', '"Approved bookings, next 7 days"', 44, Y2 + 8, 600, size=14))
parts.append(gallery('ixWeekGal',
    'ForAll(Sequence(7) As q, {D: DateAdd(Today(), q.Value - 1, TimeUnit.Days), N: CountRows(Filter(AvenueBookings, Status.Value = "Approved", StartUtc >= DateAdd(Today(), q.Value - 1, TimeUnit.Days), StartUtc < DateAdd(Today(), q.Value, TimeUnit.Days)))})',
    32, Y2 + 40, 624, PH - 48, 25,
    [child('ixWkDay', 'Text(ThisItem.D, "ddd d mmm")', 8, 2, 110, 20, Size=11, Color=SUBTLE),
     child('ixWkBar', '""', 128, 6, 20, 12, Width=bar('N', '6', 380), Fill=f'If(ThisItem.N > 0, {OLIVE}, {BORDER})'),
     child('ixWkN', 'Text(ThisItem.N)', 540, 2, 70, 20, Size=11, FontWeight='FontWeight.Bold', Align='Align.Right')]))
parts.append(panel('ixPanelMix', 680, Y2, 662, PH))
parts.append(head('ixMixHead', '"Requests by status"', 700, Y2 + 8, 620, size=14))
parts.append(gallery('ixMixGal',
    'ForAll(Table({S: "Pending"}, {S: "Approved"}, {S: "Declined"}, {S: "Cancelled"}) As q, {S: q.S, N: CountRows(Filter(AvenueBookings, Status.Value = q.S))})',
    688, Y2 + 40, 646, PH - 48, 42,
    [child('ixMxName', 'ThisItem.S', 8, 8, 150, 26, Size=13),
     child('ixMxBar', '""', 168, 14, 20, 14, Width=bar('N', '20', 380), Fill=f'If(ThisItem.S = "Approved", {OLIVE}, If(ThisItem.S = "Pending", {CITRUS}, If(ThisItem.S = "Declined", {BAD}, {SUBTLE})))'),
     child('ixMxN', 'Text(ThisItem.N)', 556, 8, 70, 26, Size=14, FontWeight='FontWeight.Bold', Align='Align.Right')]))
Y3 = Y2 + PH + 12
parts.append(panel('ixPanelPlans', 24, Y3, 640, PH))
parts.append(head('ixPlansHead', '"Active members by plan"', 44, Y3 + 8, 600, size=14))
parts.append(gallery('ixPlansGal',
    'ForAll(Filter(AvenuePlans, FacilityId = ' + FAC + ', Active = true) As q, {Name: q.Title, N: CountRows(Filter(AvenueMembers, FacilityId = ' + FAC + ', PlanId = q.PlanId, Status.Value = "Active"))})',
    32, Y3 + 40, 624, PH - 48, 25,
    [child('ixPlName', 'ThisItem.Name', 8, 2, 270, 20, Size=10),
     child('ixPlBar', '""', 288, 6, 20, 12, Width=bar('N', '10', 270), Fill=OLIVE),
     child('ixPlN', 'Text(ThisItem.N)', 560, 2, 50, 20, Size=11, FontWeight='FontWeight.Bold', Align='Align.Right')]))
parts.append(panel('ixPanelEq', 680, Y3, 662, PH))
parts.append(head('ixEqHead', '"Booked hours by equipment, last 30 days"', 700, Y3 + 8, 620, size=14))
parts.append(gallery('ixEqGal',
    'ForAll(Filter(AvenueEquipment, FacilityId = ' + FAC + ', Active = true, Kind.Value = "Equipment", Category.Value <> "Fridge") As q, {Name: q.Title, N: Sum(Filter(Filter(AvenueBookings, Status.Value = "Approved", StartUtc >= DateAdd(Today(), -30, TimeUnit.Days)), q.EquipmentId in Split(EquipmentIds, ";")), DateDiff(StartUtc, EndUtc, TimeUnit.Minutes)) / 60})',
    688, Y3 + 40, 646, PH - 48, 25,
    [child('ixEqName', 'ThisItem.Name', 8, 2, 320, 20, Size=10),
     child('ixEqBar', '""', 336, 6, 20, 12, Width=bar('N', '20', 200), Fill=OLIVE),
     child('ixEqN', 'Text(Round(ThisItem.N, 1)) & " h"', 560, 2, 70, 20, Size=11, FontWeight='FontWeight.Bold', Align='Align.Right')]))
write('insights.pa.yaml', parts)


DANGER = dict(Fill=SURFACE, Color=BAD, BorderColor=BAD, BorderThickness=1, HoverFill=BADTINT, HoverColor=BAD, HoverBorderColor=BAD, PressedFill=BADTINT)
# ---------- Compliance (Screen4): Documents | Cases | Overrides ----------
parts = nav('c', 'Screen4', 'Compliance')
_DY = cy('Screen4') - 60
CD_VIS = 'Coalesce(varCmpTab, "docs") = "docs"'
CC_VIS = 'Coalesce(varCmpTab, "docs") = "cases"'
CO_VIS = 'Coalesce(varCmpTab, "docs") = "over"'
_cases_open = 'CountRows(Filter(AvenueComplianceCases, FacilityId = ' + FAC + ', Status.Value = "Open"))'
for i, (tid, cap, w, vis) in enumerate([('docs', 'Documents', 150, CD_VIS), ('cases', 'Cases', 190, CC_VIS), ('over', 'Owner overrides', 170, CO_VIS)]):
    x = 20 + [0, 158, 356][i]
    capx = f'"{cap}"' if tid != 'cases' else '"Cases (" & ' + _cases_open + ' & " open)"'
    parts.append(button(f'cTab{tid.capitalize()}', cap, x, 60, w, 36, f'Set(varCmpTab, "{tid}")', Text=capx, Fill=f'If({vis}, {OLIVE}, {SURFACE})', Color=f'If({vis}, {CREAM}, {OLIVE})',
                        BorderColor=OLIVE, BorderThickness=1, HoverFill=f'If({vis}, {OLIVE}, {CREAM})', HoverColor=f'If({vis}, {CREAM}, {OLIVE})', PressedFill=INK2, Size=13))
# ----- Tab 1: documents -----
_VIS = CD_VIS
parts.append(label('cDocsHead', '"Member documents (expired first)"', 20, 104, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(gallery('cDocs', 'SortByColumns(Filter(AvenueMemberDocuments, FacilityId = ' + FAC + '), "ExpiryDate", SortOrder.Ascending)', 20, 138, 640, 586, 70, [
    child('cDocTitle', 'ThisItem.DocType.Value & " · " & ThisItem.MemberId', 8, 4, 600, 28, FontWeight='FontWeight.Semibold'),
    child('cDocMeta', '"Expires " & Text(ThisItem.ExpiryDate, "d mmm yyyy") & " · " & If(IsBlank(ThisItem.SupersededBy), ThisItem.DocStatus.Value, "replaced by a newer upload") & If(ThisItem.Verified, " · verified", " · not verified")', 8, 34, 600, 26,
          Size=12, Color='If(ThisItem.DocStatus.Value = "Expired" && IsBlank(ThisItem.SupersededBy), RGBA(164,38,44,1), RGBA(96,94,92,1))')]))
parts.append(label('cSel', 'If(IsBlank(cDocs.Selected), "Select a document", cDocs.Selected.DocType.Value & " for " & cDocs.Selected.MemberId)', 690, 104, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(button('cOpen', 'Open file', 690, 142, 180, 40,
    'Launch(LookUp(AvenueDocumentFiles, SourceSubmissionId = cDocs.Selected.SourceSubmissionId).\'Link to item\')', Visible='(' + CD_VIS + ') && !IsBlank(cDocs.Selected)'))
parts.append(button('cVerify', 'Mark verified', 880, 142, 180, 40,
    'Patch(AvenueMemberDocuments, cDocs.Selected, {Verified: true}); Notify("Marked as verified.", NotificationType.Success)', Visible='(' + CD_VIS + ') && !IsBlank(cDocs.Selected) && !cDocs.Selected.Verified'))
parts.append(label('cDocHelp', '"Something wrong with this document? Open the Cases tab to raise a case or place a booking hold on the member."', 690, 192, 640, 40, Size=11, Color='RGBA(96,94,92,1)'))
# ----- Tab 2: cases (member flags and staff holds) -----
_VIS = CC_VIS
CASE_SORT = 'Sort(Filter(AvenueComplianceCases, FacilityId = ' + FAC + '), If(Status.Value = "Open", 0, If(Status.Value = "Hold", 1, If(Status.Value = "More information", 2, 3))), SortOrder.Ascending)'
parts.append(label('cCaseHead', '"Compliance cases (open first) · " & CountRows(Filter(AvenueComplianceCases, FacilityId = ' + FAC + ', Active = true)) & " booking hold(s) active"', 20, 104, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(gallery('cCases', CASE_SORT, 20, 138, 640, 586, 70, [
    child('cCaseTitle', 'ThisItem.DocType.Value & " · " & ThisItem.MemberId', 8, 4, 600, 28, FontWeight='FontWeight.Semibold'),
    child('cCaseMeta', 'ThisItem.Status.Value & If(ThisItem.Active, " · BOOKING HOLD", "") & " · " & Text(ThisItem.Created, "d mmm, h:mm AM/PM")', 8, 34, 600, 26,
          Size=12, Color='If(ThisItem.Active, RGBA(164,38,44,1), If(ThisItem.Status.Value = "Open", RGBA(154,91,0,1), RGBA(96,94,92,1)))')]))
parts.append(label('cCaseSel', 'If(IsBlank(cCases.Selected), "Select a case", cCases.Selected.DocType.Value & " · " & cCases.Selected.MemberId & " · " & cCases.Selected.Status.Value)', 690, 104, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(label('cCaseWhy', 'If(IsBlank(cCases.Selected), "", "Member said: " & cCases.Selected.Reason)', 690, 138, 640, 56, Size=12, Color='RGBA(96,94,92,1)'))
parts.append(ctl('cCaseMsg', 'Classic/TextInput', {'Default': '""', 'HintText': '"Message to the member (they see it on Home and Documents)"', 'Mode': 'TextMode.MultiLine', 'X': 690, 'Y': 200, 'Width': 640, 'Height': 70}))
def _decide(status, active, need_msg):
    ok = 'Patch(AvenueComplianceCases, cCases.Selected, {Status: {Value: "' + status + '"}, StaffMessage: Trim(cCaseMsg.Text), Active: ' + active + '}); Reset(cCaseMsg); Notify("Saved. The member is told within a minute.", NotificationType.Success)'
    msg = 'If(IsBlank(Trim(cCaseMsg.Text)), Notify("Write a message the member will see.", NotificationType.Warning), IfError(' + ok + ', Notify("Could not save the case.", NotificationType.Error)))' if need_msg else 'IfError(' + ok + ', Notify("Could not save the case.", NotificationType.Error))'
    return msg
_sel = '!IsBlank(cCases.Selected)'
parts.append(button('cCaseClear', 'Clear: no issue', 690, 282, 200, 40, _decide('Cleared', 'false', False), Visible='(' + CC_VIS + ') && ' + _sel))
parts.append(button('cCaseInfo', 'Ask for more information', 900, 282, 230, 40, _decide('More information', 'false', True), Visible='(' + CC_VIS + ') && ' + _sel))
parts.append(button('cCaseHold', 'Place booking hold', 690, 330, 200, 40, _decide('Hold', 'true', True), Visible='(' + CC_VIS + ') && ' + _sel, **DANGER))
parts.append(button('cCaseRelease', 'Release hold', 900, 330, 230, 40, _decide('Released', 'false', False), Visible='(' + CC_VIS + ') && ' + _sel + ' && cCases.Selected.Active'))
parts.append(label('cCaseHelp', '"A hold refuses the member\'s new booking requests (checked by the booking flow, not by this screen). Clearing or releasing lets them book again."', 690, 380, 640, 44, Size=11, Color='RGBA(96,94,92,1)'))
parts.append(label('cHoldHead', '"Hold a member without a flag"', 690, 440, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(ctl('cHoldWho', 'Classic/TextInput', {'Default': '""', 'HintText': '"Member sign-in e-mail"', 'X': 690, 'Y': 476, 'Width': 640, 'Height': 36}))
parts.append(ctl('cHoldWhy', 'Classic/TextInput', {'Default': '""', 'HintText': '"Reason (the member sees this)"', 'Mode': 'TextMode.MultiLine', 'X': 690, 'Y': 520, 'Width': 640, 'Height': 70}))
parts.append(button('cHoldGo', 'Place hold', 690, 600, 200, 40,
    'If(!IsMatch(Trim(cHoldWho.Text), Match.Email) || IsBlank(Trim(cHoldWhy.Text)), Notify("Enter the member e-mail and a reason.", NotificationType.Warning), IfError(Patch(AvenueComplianceCases, Defaults(AvenueComplianceCases), {Title: "Hold", FacilityId: ' + FAC + ', MemberId: Lower(Trim(cHoldWho.Text)), Reason: "Placed by staff", Status: {Value: "Hold"}, StaffMessage: Trim(cHoldWhy.Text), Active: true}); Reset(cHoldWho); Reset(cHoldWhy); Notify("Hold placed.", NotificationType.Success), Notify("Could not place the hold.", NotificationType.Error)))', **DANGER))
# ----- Tab 3: owner overrides -----
_VIS = CO_VIS
parts.append(label('cOvHead', '"Owner override (expired documents)"', 20, 104, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(label('cOvHelp', '"Only the Flavors owner can grant or revoke an override; SharePoint refuses it for staff."', 20, 134, 640, 40, Size=11, Color='RGBA(96,94,92,1)'))
parts.append(ctl('cOvMember', 'Classic/TextInput', {'Default': 'If(IsBlank(cDocs.Selected), "", cDocs.Selected.MemberId)', 'HintText': '"Member e-mail"', 'X': 20, 'Y': 180, 'Width': 420, 'Height': 36}))
parts.append(ctl('cOvReason', 'Classic/TextInput', {'Default': '""', 'HintText': '"Reason (recorded)"', 'Mode': 'TextMode.MultiLine', 'X': 20, 'Y': 225, 'Width': 640, 'Height': 70}))
parts.append(button('cOvGrant', 'Grant override', 20, 305, 200, 40,
    'If(IsBlank(cOvMember.Text) || IsBlank(cOvReason.Text), Notify("Enter the member and a reason.", NotificationType.Warning), IfError(Patch(AvenueComplianceOverrides, Defaults(AvenueComplianceOverrides), {Title: "Override", FacilityId: ' + FAC + ', MemberId: Lower(Trim(cOvMember.Text)), Reason: cOvReason.Text, Active: true}); Reset(cOvReason); Notify("Override granted.", NotificationType.Success), Notify("Only the Flavors owner can grant overrides.", NotificationType.Error)))'))
parts.append(label('cOvListHead', '"Active overrides"', 20, 360, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(gallery('cOvList', 'Filter(AvenueComplianceOverrides, Active = true)', 20, 394, 640, 330, 60, [
    child('cOvItem', 'ThisItem.MemberId & " · by " & ThisItem.\'Created By\'.DisplayName & " · " & Text(ThisItem.Created, "d mmm yyyy")', 8, 4, 470, 26),
    child('cOvWhy', 'ThisItem.Reason', 8, 30, 470, 24, Size=11, Color='RGBA(96,94,92,1)'),
    ('cOvRevoke', 'Classic/Button', {'Text': '"Revoke"', 'X': 500, 'Y': 10, 'Width': 120, 'Height': 34,
        'OnSelect': 'IfError(Patch(AvenueComplianceOverrides, ThisItem, {Active: false}); Notify("Override revoked.", NotificationType.Success), Notify("Only the Flavors owner can revoke overrides.", NotificationType.Error))'})]))
_VIS = None
write('compliance.pa.yaml', parts)
_DY = 0

# ---------- Check-ins (Screen5) ----------
parts = nav('k', 'Screen5', 'Check-ins')
_DY = cy('Screen5') - 60
parts.append(label('kRecentHead', '"Recent checklists (failed in red)"', 20, 60, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(gallery('kRecent', 'SortByColumns(Filter(AvenueCheckIns, FacilityId = ' + FAC + '), "SubmittedAt", SortOrder.Descending)', 20, 95, 640, 330, 64, [
    child('kRecTitle', 'ThisItem.Kind.Value & " · " & ThisItem.MemberId', 8, 4, 600, 28, FontWeight='FontWeight.Semibold', Color='If(ThisItem.AllPassed, RGBA(36,36,36,1), RGBA(164,38,44,1))'),
    child('kRecMeta', 'Text(ThisItem.SubmittedAt, "ddd d mmm, h:mm AM/PM") & " · booking " & ThisItem.BookingId & If(ThisItem.AllPassed, "", If(IsBlank(ThisItem.ResolvedAt), " · FAILED", " · failed, resolved"))', 8, 32, 600, 24, Size=12, Color='RGBA(96,94,92,1)')]))
parts.append(label('kAnsHead', 'If(IsBlank(kRecent.Selected), "Select a checklist to see the answers", "Answers")', 690, 60, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(label('kAnswers', 'If(IsBlank(kRecent.Selected), "", IfError(Concat(Table(ParseJSON(kRecent.Selected.Answers)), Text(ThisRecord.Value.q) & "  →  " & Text(ThisRecord.Value.a), Char(10)), kRecent.Selected.Answers))',
                   690, 95, 640, 150, VerticalAlign='VerticalAlign.Top'))
# A failed checklist stays open until staff log what was done (who, when, what): resolved by/at/note on AvenueCheckIns (CHK-05).
FAIL_OPEN = '!IsBlank(kRecent.Selected) && !kRecent.Selected.AllPassed && IsBlank(kRecent.Selected.ResolvedAt)'
parts.append(ctl('kFailNote', 'Classic/TextInput', {'Default': '""', 'HintText': '"Follow-up on this failed checklist (what was done)"', 'X': 690, 'Y': 250, 'Width': 640, 'Height': 46, 'Mode': 'TextMode.MultiLine', 'Visible': FAIL_OPEN}))
parts.append(button('kFailResolve', 'Log follow-up and resolve', 690, 302, 260, 34,
    'Patch(AvenueCheckIns, kRecent.Selected, {ResolvedAt: Now(), ResolvedBy: User().Email, ResolutionNote: kFailNote.Text}); Reset(kFailNote); Refresh(AvenueCheckIns)',
    DisplayMode='If(IsBlank(Trim(kFailNote.Text)), DisplayMode.Disabled, DisplayMode.Edit)', Visible=FAIL_OPEN))
parts.append(label('kFailDone', 'If(!IsBlank(kRecent.Selected) && !kRecent.Selected.AllPassed && !IsBlank(kRecent.Selected.ResolvedAt), "Resolved by " & kRecent.Selected.ResolvedBy & " on " & Text(kRecent.Selected.ResolvedAt, "d mmm, h:mm AM/PM") & ": " & kRecent.Selected.ResolutionNote, "")', 690, 250, 640, 80, Size=12, Color='RGBA(96,94,92,1)'))
parts.append(label('kMissHead', '"Missed entry checklist: member reminded, staff to follow up"', 690, 360, 640, 30, FontWeight='FontWeight.Semibold'))
# Bookings the "Avenue - Missed entry checklist" flow has flagged (MissedCheckInAt) that still have no entry checklist and no
# logged outreach. The inner Filter is fully delegable (keeps the row set small); IsBlank is applied locally. Logging outreach resolves the case so it never reopens (CHK-04).
parts.append(gallery('kMissed',
    MISSED_ITEMS,
    690, 395, 640, 230, 56, [
    child('kMissTitle', 'Coalesce(LookUp(AvenueMembers, MemberId = ThisItem.MemberId).BusinessName, "Member") & " · " & ThisItem.MemberId', 8, 4, 600, 26, FontWeight='FontWeight.Semibold'),
    child('kMissMeta', 'ThisItem.Space.Value & " · " & Text(ThisItem.StartUtc, "h:mm AM/PM") & "–" & Text(ThisItem.EndUtc, "h:mm AM/PM") & " · reminded " & Text(ThisItem.MissedCheckInAt, "h:mm AM/PM")', 8, 30, 600, 22, Size=12, Color='RGBA(96,94,92,1)')]))
parts.append(ctl('kOutreachNote', 'Classic/TextInput', {'Default': '""', 'HintText': '"What was done (call, message, resolved on site)"', 'X': 690, 'Y': 635, 'Width': 640, 'Height': 60, 'Mode': 'TextMode.MultiLine'}))
parts.append(button('kRefresh', 'Refresh', 690, 705, 160, 36, 'Refresh(AvenueCheckIns); Refresh(AvenueBookings); Refresh(AvenueMembers)'))
parts.append(label('kExitHead', '"Exit checklist overdue: member reminded, staff to follow up"', 20, 440, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(gallery('kExits', EXITS_ITEMS, 20, 475, 640, 160, 56, [
    child('kExitTitle', 'Coalesce(LookUp(AvenueMembers, MemberId = ThisItem.MemberId).BusinessName, "Member") & " · " & ThisItem.MemberId', 8, 4, 600, 26, FontWeight='FontWeight.Semibold'),
    child('kExitMeta', 'ThisItem.Space.Value & " · ended " & Text(ThisItem.EndUtc, "h:mm AM/PM") & " · reminded " & Text(ThisItem.ExitFlaggedAt, "h:mm AM/PM")', 8, 30, 600, 22, Size=12, Color='RGBA(96,94,92,1)')]))
parts.append(ctl('kExitNote', 'Classic/TextInput', {'Default': '""', 'HintText': '"What was done (call, extension agreed, resolved on site)"', 'X': 20, 'Y': 645, 'Width': 640, 'Height': 50, 'Mode': 'TextMode.MultiLine'}))
parts.append(button('kExitResolve', 'Log outreach and resolve', 20, 705, 260, 36,
    'Patch(AvenueBookings, kExits.Selected, {ExitOutreachAt: Now(), ExitOutreachBy: User().Email, ExitOutreachNote: kExitNote.Text}); Reset(kExitNote); Refresh(AvenueBookings)',
    DisplayMode='If(IsBlank(kExits.Selected) || IsBlank(Trim(kExitNote.Text)), DisplayMode.Disabled, DisplayMode.Edit)'))
parts.append(button('kResolve', 'Log outreach and resolve', 860, 705, 260, 36,
    'Patch(AvenueBookings, kMissed.Selected, {OutreachAt: Now(), OutreachBy: User().Email, OutreachNote: kOutreachNote.Text}); Reset(kOutreachNote); Refresh(AvenueBookings)',
    DisplayMode='If(IsBlank(kMissed.Selected) || IsBlank(Trim(kOutreachNote.Text)), DisplayMode.Disabled, DisplayMode.Edit)'))
write('checkins.pa.yaml', parts)
_DY = 0

# ---------- Notices (Screen6) ----------
# Drafts and withdrawn notices live in AvenueNoticeDrafts (staff only); only published notices sit in AvenueNotices, which members can read.
# Withdrawing copies the notice to AvenueNoticeDrafts (State = Withdrawn) and then removes it from AvenueNotices (SOP-08, fail closed).
Y0 = cy('Screen6')
DANGER = dict(Fill=SURFACE, Color=BAD, BorderColor=BAD, BorderThickness=1, HoverFill=BADTINT, HoverColor=BAD, HoverBorderColor=BAD, PressedFill=BADTINT)
parts = nav('n', 'Screen6', 'Notices')
# Editing: varNEdit holds the draft being edited (a row of AvenueNoticeDrafts). Editing a PUBLISHED notice = withdraw it (the Withdrawn copy is
# kept as the record) + open a new Draft copy here; Publish then creates a fresh notice. Members see it as a new notice (new id).
# Expiry [PROPOSED, Q-R1]: "Hide after N hours", default 24, empty = keep until withdrawn. Expired notices are hidden, never deleted.
# A draft stores ExpiresAt = save time + N h; publishing a draft keeps the same N h from the publish time (DateDiff from Modified).
NE = 'varNEdit'
CANPOST = CAN('PostNotices')
parts.append(panel('nPanelNew', 24, Y0, 640, 688))
parts.append(head('nNewHead', 'If(IsBlank(' + NE + '), "Write a notice", "Editing draft: " & ' + NE + '.Title)', 44, Y0 + 12, 560, 20))
parts.append(hint('nNewHelp', '"Publishing shows it to all members in the portal. Any e-mail only says there is a new notice (COM-02). Drafts stay private to staff."', 44, Y0 + 52, 600, 36))
parts.append(ctl('nNoticeTitle', 'Classic/TextInput', {'Default': 'If(IsBlank(' + NE + '), "", ' + NE + '.Title)', 'HintText': '"Title"', 'X': 44, 'Y': Y0 + 96, 'Width': 600, 'Height': 40, 'Size': 14}))
parts.append(ctl('nBody', 'Classic/TextInput', {'Default': 'If(IsBlank(' + NE + '), "", ' + NE + '.Body)', 'HintText': '"Notice text"', 'Mode': 'TextMode.MultiLine', 'X': 44, 'Y': Y0 + 144, 'Width': 600, 'Height': 200}))
parts.append(label('nCatLbl', '"Category"', 44, Y0 + 360, 120, 24, Size=12, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(ctl('nCategory', 'Classic/DropDown', {'Items': '["General", "Maintenance", "Schedule", "Urgent"]', 'Default': 'If(IsBlank(' + NE + '), "General", Coalesce(' + NE + '.Category.Value, "General"))', 'X': 44, 'Y': Y0 + 386, 'Width': 190, 'Height': 36}))
parts.append(label('nPinLbl', '"Pin to top"', 260, Y0 + 360, 120, 24, Size=12, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(ctl('nPinned', 'Classic/Toggle', {'Default': 'If(IsBlank(' + NE + '), false, Coalesce(' + NE + '.Pinned, false))', 'X': 260, 'Y': Y0 + 388, 'Width': 90, 'Height': 30}))
parts.append(label('nExpLbl', '"Hide after (hours)"', 380, Y0 + 360, 200, 24, Size=12, FontWeight='FontWeight.Bold', Color=SUBTLE))
N_LEFT = 'DateDiff(' + NE + '.Modified, ' + NE + '.ExpiresAt, TimeUnit.Hours)'
parts.append(ctl('nExpHours', 'Classic/TextInput', {'Default': 'If(IsBlank(' + NE + '), "24", If(IsBlank(' + NE + '.ExpiresAt), "", Text(Max(1, ' + N_LEFT + '))))', 'HintText': '"Empty = keep"', 'Format': 'TextFormat.Number',
                                                    'X': 380, 'Y': Y0 + 386, 'Width': 120, 'Height': 36}))
parts.append(hint('nExpHelp', '"24 h by default [PROPOSED, Q-R1]; empty keeps it until withdrawn. Expired notices are hidden, not deleted."', 508, Y0 + 382, 140, 48, Size=9))
N_OK = '!IsBlank(Trim(nNoticeTitle.Text)) && !IsBlank(Trim(nBody.Text)) && (IsBlank(Trim(nExpHours.Text)) || (IsNumeric(nExpHours.Text) && Value(nExpHours.Text) > 0))'
N_EXP = 'If(IsBlank(Trim(nExpHours.Text)), Blank(), DateAdd(Now(), Value(nExpHours.Text), TimeUnit.Hours))'
N_EXTRA = 'Category: {Value: nCategory.Selected.Value}, Pinned: nPinned.Value, ExpiresAt: ' + N_EXP
N_RESET = 'Reset(nNoticeTitle); Reset(nBody); Reset(nCategory); Reset(nPinned); Reset(nExpHours)'
N_DRAFT_ROW = 'LookUp(AvenueNoticeDrafts, ID = ' + NE + '.ID)'
N_WARN = 'Notify("Enter a title and the notice text; hide-after must be empty or a number of hours above 0.", NotificationType.Warning)'
parts.append(button('nPublish', 'Publish', 44, Y0 + 452, 200, 44,
    'If(!(' + N_OK + '), ' + N_WARN + ', IfError(Patch(AvenueNotices, Defaults(AvenueNotices), {Title: Left(Trim(nNoticeTitle.Text), 255), Body: nBody.Text, FacilityId: ' + FAC + ', PublishedAt: Now(), Active: true, ' + N_EXTRA + '}); '
    'If(!IsBlank(' + NE + '), Remove(AvenueNoticeDrafts, ' + N_DRAFT_ROW + ')); Set(' + NE + ', Blank()); ' + N_RESET + '; Notify("Notice published.", NotificationType.Success), Notify("Could not publish the notice.", NotificationType.Error)))', Visible=CANPOST))
parts.append(button2('nDraft', 'Save as draft', 256, Y0 + 452, 200, 44,
    'If(!(' + N_OK + '), ' + N_WARN + ', IfError(Patch(AvenueNoticeDrafts, If(IsBlank(' + NE + '), Defaults(AvenueNoticeDrafts), ' + N_DRAFT_ROW + '), {Title: Left(Trim(nNoticeTitle.Text), 255), Body: nBody.Text, FacilityId: ' + FAC + ', State: {Value: "Draft"}, ' + N_EXTRA + '}); '
    'Set(' + NE + ', Blank()); ' + N_RESET + '; Notify("Draft saved. Members cannot see it.", NotificationType.Success), Notify("Could not save the draft.", NotificationType.Error)))', Visible=CANPOST))
parts.append(button2('nEditCancel', 'Stop editing', 468, Y0 + 452, 176, 44, 'Set(' + NE + ', Blank()); ' + N_RESET, Visible='!IsBlank(' + NE + ')'))
parts.append(hint('nEditHelp', '"Stop editing keeps the draft as it was last saved."', 44, Y0 + 504, 600, 24, Visible='!IsBlank(' + NE + ')'))
parts.append(panel('nPanelList', 680, Y0, 662, 336))
parts.append(head('nListHead', '"Published (members can read these)"', 700, Y0 + 12, 620, 16))
N_WITHDRAW_COPY = 'Patch(AvenueNoticeDrafts, Defaults(AvenueNoticeDrafts), {Title: ThisItem.Title, Body: ThisItem.Body, FacilityId: ThisItem.FacilityId, State: {Value: "Withdrawn"}, Category: ThisItem.Category, Pinned: ThisItem.Pinned, ExpiresAt: ThisItem.ExpiresAt, PublishedAt: ThisItem.PublishedAt, WithdrawnAt: Now(), WithdrawnBy: User().Email})'
parts.append(gallery('nList', 'SortByColumns(Filter(AvenueNotices, Active = true), "Pinned", SortOrder.Descending, "PublishedAt", SortOrder.Descending)', 688, Y0 + 52, 646, 276, 76, [
    child('nItemTitle', 'ThisItem.Title', 8, 6, 400, 28, FontWeight='FontWeight.Bold', Size=13),
    child('nItemMeta', 'If(ThisItem.Pinned = true, "PINNED · ", "") & Coalesce(ThisItem.Category.Value, "General") & " · " & Text(ThisItem.PublishedAt, "d mmm yyyy, h:mm AM/PM") & If(IsBlank(ThisItem.ExpiresAt), "", If(ThisItem.ExpiresAt < Now(), " · EXPIRED (hidden from members)", " · hides " & Text(ThisItem.ExpiresAt, "d mmm, h:mm AM/PM")))', 8, 36, 400, 34, Size=10, Color=SUBTLE),
    ('nEdit', 'Classic/Button', {'Text': '"Edit"', 'X': 420, 'Y': 20, 'Width': 80, 'Height': 34, 'Size': 12, 'FontWeight': SEMI, **_RAD, 'Fill': SURFACE, 'Color': OLIVE, 'BorderColor': OLIVE, 'BorderThickness': 1, 'Visible': CANPOST,
        'OnSelect': 'IfError(' + N_WITHDRAW_COPY + '; Set(' + NE + ', Patch(AvenueNoticeDrafts, Defaults(AvenueNoticeDrafts), {Title: ThisItem.Title, Body: ThisItem.Body, FacilityId: ThisItem.FacilityId, State: {Value: "Draft"}, Category: ThisItem.Category, Pinned: ThisItem.Pinned, ExpiresAt: ThisItem.ExpiresAt})); Remove(AvenueNotices, ThisItem); '
                    'Notify("Withdrawn for editing (members no longer see it). Change it on the left and press Publish.", NotificationType.Information), Notify("Could not open the notice for editing.", NotificationType.Error))'}),
    ('nWithdraw', 'Classic/Button', dict({'Text': '"Withdraw"', 'X': 508, 'Y': 20, 'Width': 120, 'Height': 34, 'Size': 12, 'FontWeight': SEMI, **_RAD, 'Visible': CANPOST,
        'OnSelect': 'IfError(' + N_WITHDRAW_COPY + '; Remove(AvenueNotices, ThisItem); Notify("Notice withdrawn. Members can no longer read it.", NotificationType.Information), Notify("Could not withdraw the notice.", NotificationType.Error))'}, **DANGER))]))
parts.append(panel('nPanelDrafts', 680, Y0 + 352, 662, 336))
parts.append(head('nDraftHead', '"Drafts and withdrawn (staff only)"', 700, Y0 + 364, 620, 16))
N_KEEP = 'DateDiff(ThisItem.Modified, ThisItem.ExpiresAt, TimeUnit.Minutes)'
parts.append(gallery('nDrafts', 'SortByColumns(AvenueNoticeDrafts, "Created", SortOrder.Descending)', 688, Y0 + 404, 646, 276, 76, [
    child('nDrTitle', 'ThisItem.Title', 8, 6, 350, 28, FontWeight='FontWeight.Bold', Size=13),
    child('nDrMeta', 'Coalesce(ThisItem.Category.Value, "General") & If(ThisItem.Pinned = true, " · pinned", "") & " · " & ThisItem.State.Value & If(ThisItem.State.Value = "Withdrawn", " · by " & ThisItem.WithdrawnBy & " " & Text(ThisItem.WithdrawnAt, "d mmm, h:mm AM/PM"), " · saved " & Text(ThisItem.Modified, "d mmm, h:mm AM/PM"))', 8, 36, 350, 34, Size=10, Color=SUBTLE),
    ('nDrEdit', 'Classic/Button', {'Text': '"Edit"', 'X': 368, 'Y': 20, 'Width': 72, 'Height': 34, 'Size': 12, 'FontWeight': SEMI, **_RAD, 'Fill': SURFACE, 'Color': OLIVE, 'BorderColor': OLIVE, 'BorderThickness': 1,
        'Visible': 'ThisItem.State.Value = "Draft" && ' + CANPOST, 'OnSelect': 'Set(' + NE + ', ThisItem)'}),
    ('nDrPublish', 'Classic/Button', {'Text': '"Publish"', 'X': 448, 'Y': 20, 'Width': 90, 'Height': 34, 'Size': 12, 'FontWeight': SEMI, 'Fill': CITRUS, 'Color': SURFACE, 'HoverFill': CITRUS_DK, 'BorderThickness': 0, **_RAD, 'Visible': CANPOST,
        'OnSelect': 'If(!IsBlank(ThisItem.ExpiresAt) && ' + N_KEEP + ' <= 0, Notify("Its hide-after time had already passed when it was saved. Edit it and set new hours.", NotificationType.Warning), IfError(Patch(AvenueNotices, Defaults(AvenueNotices), {Title: ThisItem.Title, Body: ThisItem.Body, FacilityId: ThisItem.FacilityId, Category: ThisItem.Category, Pinned: ThisItem.Pinned, '
                    'ExpiresAt: If(IsBlank(ThisItem.ExpiresAt), Blank(), DateAdd(Now(), ' + N_KEEP + ', TimeUnit.Minutes)), PublishedAt: Now(), Active: true}); Remove(AvenueNoticeDrafts, ThisItem); Notify("Notice published.", NotificationType.Success), Notify("Could not publish the notice.", NotificationType.Error)))'}),
    ('nDrDelete', 'Classic/Button', dict({'Text': '"Delete"', 'X': 546, 'Y': 20, 'Width': 80, 'Height': 34, 'Size': 12, 'FontWeight': SEMI, **_RAD, 'Visible': CANPOST,
        'OnSelect': 'If(ThisItem.State.Value = "Draft", IfError(Remove(AvenueNoticeDrafts, ThisItem); Notify("Draft deleted.", NotificationType.Information), Notify("Could not delete the draft.", NotificationType.Error)), Notify("Withdrawn notices are kept as a record.", NotificationType.Warning))'}, **DANGER))]))
write('notices.pa.yaml', parts)

# ---------- Checklist setup (Screen7) ----------
parts = nav('q', 'Screen7', 'Checklist setup')
_DY = cy('Screen7') - 60
parts.append(label('qHelp', '"Flavors\' own entry, exit and team wellness questions (Q-10). Members answer Yes or No to each. Edit a question in place and press Save on its row."', 20, 60, 1300, 30, Size=12, Color='RGBA(96,94,92,1)'))
parts.append(ctl('qKind', 'Classic/DropDown', {'Items': '["Entry", "Exit", "Wellness"]', 'Default': '"Entry"', 'X': 20, 'Y': 100, 'Width': 160, 'Height': 36}))
parts.append(ctl('qText', 'Classic/TextInput', {'Default': '""', 'HintText': '"Question"', 'X': 190, 'Y': 100, 'Width': 700, 'Height': 36}))
parts.append(ctl('qOrder', 'Classic/TextInput', {'Default': '"1"', 'HintText': '"Order"', 'Format': 'TextFormat.Number', 'X': 900, 'Y': 100, 'Width': 90, 'Height': 36}))
parts.append(button('qAdd', 'Add question', 1000, 100, 180, 36,
    'If(IsBlank(Trim(qText.Text)), Notify("Enter the question.", NotificationType.Warning), Patch(AvenueChecklistQuestions, Defaults(AvenueChecklistQuestions), {Title: Left(Trim(qText.Text), 255), FacilityId: ' + FAC + ', Kind: {Value: qKind.Selected.Value}, Question: Trim(qText.Text), SortOrder: Value(qOrder.Text), Active: true}); Reset(qText); Notify("Question added.", NotificationType.Success))'))
for i, kind in enumerate(['Entry', 'Exit', 'Wellness']):
    x = 20 + i * 445
    parts.append(label(f'q{kind}Head', f'"{kind} checklist"', x, 150, 430, 30, FontWeight='FontWeight.Semibold'))
    parts.append(gallery(f'q{kind}List', f'SortByColumns(Filter(AvenueChecklistQuestions, Active = true, Kind.Value = "{kind}"), "SortOrder", SortOrder.Ascending)', x, 185, 430, 560, 92, [
        (f'q{kind}Ord', 'Classic/TextInput', {'Default': 'Text(ThisItem.SortOrder)', 'Format': 'TextFormat.Number', 'X': 8, 'Y': 6, 'Width': 52, 'Height': 36, 'BorderColor': BORDER, 'BorderThickness': 1, 'Color': TEXT, 'Fill': SURFACE}),
        (f'q{kind}Q', 'Classic/TextInput', {'Default': 'ThisItem.Question', 'Mode': 'TextMode.MultiLine', 'X': 66, 'Y': 6, 'Width': 340, 'Height': 44, 'Size': 11, 'BorderColor': BORDER, 'BorderThickness': 1, 'Color': TEXT, 'Fill': SURFACE}),
        (f'q{kind}Save', 'Classic/Button', {'Text': '"Save"', 'X': 66, 'Y': 54, 'Width': 90, 'Height': 30, 'Size': 11,
            'OnSelect': f'If(IsBlank(Trim(q{kind}Q.Text)) || !IsNumeric(q{kind}Ord.Text), Notify("Enter the question and a number for its order.", NotificationType.Warning), IfError(Patch(AvenueChecklistQuestions, LookUp(AvenueChecklistQuestions, ID = ThisItem.ID), {{Title: Left(Trim(q{kind}Q.Text), 255), Question: Trim(q{kind}Q.Text), SortOrder: Value(q{kind}Ord.Text)}}); Notify("Question saved.", NotificationType.Success), Notify("Could not save the question.", NotificationType.Error)))'}),
        (f'q{kind}Remove', 'Classic/Button', {'Text': '"Remove"', 'X': 166, 'Y': 54, 'Width': 90, 'Height': 30, 'Size': 11,
            'OnSelect': 'IfError(Patch(AvenueChecklistQuestions, LookUp(AvenueChecklistQuestions, ID = ThisItem.ID), {Active: false}); Notify("Question removed (kept as inactive).", NotificationType.Information), Notify("Could not remove it.", NotificationType.Error))'})]))
write('checklist.pa.yaml', parts)
_DY = 0

RD_ITEM = 'CountRows(Filter(Filter(AvenueRequiredDocTypes, Active = true) As r, !IsBlank(LookUp(AvenueMemberDocuments, MemberId = ThisItem.MemberId && DocType.Value = r.DocType.Value && IsBlank(SupersededBy) && DocStatus.Value <> "Expired"))))'
RD_SEL = 'CountRows(Filter(Filter(AvenueRequiredDocTypes, Active = true) As r, !IsBlank(LookUp(AvenueMemberDocuments, MemberId = mList.Selected.MemberId && DocType.Value = r.DocType.Value && IsBlank(SupersededBy) && DocStatus.Value <> "Expired"))))'
def DEACT(sel, reason):
    """Deactivate a member (never delete): Status Inactive with reason, cancel future bookings, ask the host to end the Stripe subscription.
    Shared by Members (Screen8, frozen output) and Member admin (Screen23)."""
    return ('With({m: ' + sel + '}, IfError(Patch(AvenueMembers, m, {Status: {Value: "Inactive"}, ChangeReason: Trim(' + reason + '.Text) & " (" & User().Email & ", " & Text(Now(), "d mmm yyyy h:mm AM/PM") & ")"}); Reset(' + reason + '); ForAll(Filter(AvenueBookings, MemberId = m.MemberId, StartUtc > Now(), Status.Value = "Approved" || Status.Value = "Pending") As b, Patch(AvenueBookings, b, {Status: {Value: "Cancelled"}, OverlapNote: "Cancelled because the membership was deactivated."})); If(!IsBlank(m.SubscriptionId), Patch(AvenueHostRequests, Defaults(AvenueHostRequests), {Title: "CancelSubscription", FacilityId: ' + FAC + ', RequestId: "cancel-" & Text(GUID()), Kind: {Value: "CancelSubscription"}, Payload: "{""memberEmail"":""" & m.MemberId & """}"})); Notify("Member deactivated; future bookings cancelled and hours returned. Their Stripe subscription ends at the end of the paid period.", NotificationType.Success), Notify("Could not deactivate the member.", NotificationType.Error)))')
# ---------- Members (Screen8) ----------
parts = nav('m', 'Screen8', 'Members')
_DY = cy('Screen8') - 60
parts.append(label('mListHead', '"Members"', 20, 60, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(gallery('mList', 'SortByColumns(Filter(AvenueMembers, FacilityId = ' + FAC + '), "BusinessName", SortOrder.Ascending)', 20, 95, 640, 650, 60, [
    child('mItemTitle', 'Coalesce(ThisItem.BusinessName, "(no business name)") & " · " & ThisItem.MemberId', 8, 4, 600, 26, FontWeight='FontWeight.Semibold'),
    child('mItemMeta', 'ThisItem.Status.Value & " · plan " & Coalesce(ThisItem.PlanId, "not set") & If(IsBlank(ThisItem.CollectionDay), "", " · day " & ThisItem.CollectionDay) & " · documents " & '+RD_ITEM+' & " of " & CountRows(Filter(AvenueRequiredDocTypes, Active = true)) & If(IsBlank(ThisItem.PaymentStatus.Value), "", " · payment " & Switch(ThisItem.PaymentStatus.Value, "PastDue", "OVERDUE", "Unpaid", "UNPAID", "OwnerOverride", "owner override", ThisItem.PaymentStatus.Value))', 8, 32, 600, 22, Size=12,
          Color='If(ThisItem.Status.Value = "Inactive" || ThisItem.PaymentStatus.Value = "PastDue" || ThisItem.PaymentStatus.Value = "Unpaid", RGBA(164,38,44,1), RGBA(96,94,92,1))')]))
parts.append(label('mSel', 'If(IsBlank(mList.Selected), "Select a member", mList.Selected.BusinessName & " · " & mList.Selected.Status.Value)', 690, 60, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(ctl('mStatus', 'Classic/DropDown', {'Items': 'If(!IsBlank(mList.Selected) && mList.Selected.Status.Value = "Inactive", ["Inactive", "Invited", "Paid", "Onboarding", "Active"], ["Invited", "Paid", "Onboarding", "Active"])', 'Default': 'If(IsBlank(mList.Selected), "Active", mList.Selected.Status.Value)', 'X': 690, 'Y': 95, 'Width': 200, 'Height': 36}))
parts.append(ctl('mPlanEdit', 'Classic/TextInput', {'Default': 'If(IsBlank(mList.Selected), "", mList.Selected.PlanId)', 'HintText': '"Plan id"', 'X': 900, 'Y': 95, 'Width': 150, 'Height': 36}))
parts.append(ctl('mDayEdit', 'Classic/TextInput', {'Default': 'If(IsBlank(mList.Selected) || IsBlank(mList.Selected.CollectionDay), "", Text(mList.Selected.CollectionDay))', 'HintText': '"Day 1-15"', 'Format': 'TextFormat.Number', 'X': 1060, 'Y': 95, 'Width': 90, 'Height': 36}))
parts.append(ctl('mReason', 'Classic/TextInput', {'Default': '""', 'HintText': '"Reason (needed to deactivate or reactivate)"', 'X': 1060, 'Y': 140, 'Width': 270, 'Height': 36}))
REACT = '!IsBlank(mList.Selected) && mList.Selected.Status.Value = "Inactive" && mStatus.Selected.Value <> "Inactive"'
parts.append(button('mSave', 'Save', 1160, 95, 100, 36,
    'If(!IsBlank(mDayEdit.Text) && !(Value(mDayEdit.Text) >= 1 && Value(mDayEdit.Text) <= 15 && Value(mDayEdit.Text) = RoundDown(Value(mDayEdit.Text), 0)), Notify("Collection day must be a whole number from 1 to 15.", NotificationType.Warning), IfError(Patch(AvenueMembers, mList.Selected, {Status: {Value: mStatus.Selected.Value}, PlanId: Trim(mPlanEdit.Text), CollectionDay: If(IsBlank(mDayEdit.Text), Blank(), Value(mDayEdit.Text)), ChangeReason: If(IsBlank(Trim(mReason.Text)), mList.Selected.ChangeReason, Trim(mReason.Text) & " (" & User().Email & ", " & Text(Now(), "d mmm yyyy h:mm AM/PM") & ")")}); Reset(mReason); Notify("Member saved. Their membership card updates within a minute.", NotificationType.Success), Notify("Could not save the member.", NotificationType.Error)))',
    DisplayMode='If(IsBlank(mList.Selected) || (' + REACT + ' && IsBlank(Trim(mReason.Text))), DisplayMode.Disabled, DisplayMode.Edit)'))
parts.append(button('mDeactivate', 'Deactivate and cancel future bookings', 690, 140, 360, 36,
    DEACT('mList.Selected', 'mReason'),
    DisplayMode='If(IsBlank(mList.Selected) || mList.Selected.Status.Value = "Inactive" || IsBlank(Trim(mReason.Text)), DisplayMode.Disabled, DisplayMode.Edit)', Fill='RGBA(164,38,44,1)'))
parts.append(label('mDeactHelp', 'If(IsBlank(mList.Selected), "", "Onboarding: " & ' + RD_SEL + ' & " of " & CountRows(Filter(AvenueRequiredDocTypes, Active = true)) & " required documents on file. ") & "Removing their sign-in to the site is a SharePoint admin step (guest access); this keeps all history."', 690, 178, 640, 38, Size=11, Color='RGBA(96,94,92,1)'))
parts.append(label('mUpHead', '"Upcoming bookings"', 690, 220, 360, 30, FontWeight='FontWeight.Semibold'))
# Owner-only override of the overdue booking block (BKG-14). ponytail: a UI gate only (owner logins from the client sheet); SharePoint
# still lets staff edit AvenueMembers (logged in docs/CLIENT_REVIEW_DEFAULTS.md, Q-15). Move to an owner-write list if staff must be stopped.
parts.append(button('mOverride', 'Allow bookings (owner override)', 1060, 216, 270, 34,
    'IfError(Patch(AvenueMembers, mList.Selected, {PaymentStatus: {Value: "OwnerOverride"}, ChangeReason: "Overdue booking block lifted by " & User().Email & ", " & Text(Now(), "d mmm yyyy h:mm AM/PM")}); Notify("Override saved: new bookings are allowed until the next payment status change.", NotificationType.Success), Notify("Could not save the override.", NotificationType.Error))',
    Visible='!IsBlank(mList.Selected) && (mList.Selected.PaymentStatus.Value = "PastDue" || mList.Selected.PaymentStatus.Value = "Unpaid") && Lower(User().Email) in ' + OWNER_EMAILS))
parts.append(gallery('mUpcoming', 'If(IsBlank(mList.Selected), Blank(), SortByColumns(Filter(AvenueBookings, MemberId = mList.Selected.MemberId, StartUtc > Now()), "StartUtc", SortOrder.Ascending))', 690, 254, 640, 196, 40, [
    child('mUpItem', 'ThisItem.Space.Value & " · " & Text(ThisItem.StartUtc, "ddd d mmm, h:mm AM/PM") & " · " & ThisItem.Status.Value', 8, 6, 600, 28)]))
parts.append(label('mAddHead', '"Add a member"', 690, 465, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(label('mAddHelp', '"Normally members join by paying first (Stripe, not set up yet). Use this for members who already pay outside Avenue. Site access is granted separately by a SharePoint admin."', 690, 495, 640, 40, Size=11, Color='RGBA(96,94,92,1)'))
parts.append(ctl('mBiz', 'Classic/TextInput', {'Default': '""', 'HintText': '"Business name"', 'X': 690, 'Y': 540, 'Width': 640, 'Height': 36}))
parts.append(ctl('mEmail', 'Classic/TextInput', {'Default': '""', 'HintText': '"Member sign-in e-mail"', 'X': 690, 'Y': 585, 'Width': 420, 'Height': 36}))
parts.append(ctl('mPlan', 'Classic/TextInput', {'Default': '""', 'HintText': '"Plan id (optional)"', 'X': 1120, 'Y': 585, 'Width': 120, 'Height': 36}))
parts.append(ctl('mDay', 'Classic/TextInput', {'Default': '""', 'HintText': '"Day 1-15"', 'Format': 'TextFormat.Number', 'X': 1250, 'Y': 585, 'Width': 80, 'Height': 36}))
parts.append(button('mAdd', 'Add member', 690, 635, 200, 40,
    'If(IsBlank(Trim(mBiz.Text)) || !IsMatch(Trim(mEmail.Text), Match.Email), Notify("Enter a business name and a valid e-mail.", NotificationType.Warning), !IsBlank(mDay.Text) && !(Value(mDay.Text) >= 1 && Value(mDay.Text) <= 15 && Value(mDay.Text) = RoundDown(Value(mDay.Text), 0)), Notify("Collection day must be a whole number from 1 to 15.", NotificationType.Warning), IfError(Patch(AvenueMembers, Defaults(AvenueMembers), {Title: Left(Trim(mBiz.Text), 255), FacilityId: ' + FAC + ', MemberId: Lower(Trim(mEmail.Text)), BusinessName: Trim(mBiz.Text), PlanId: Trim(mPlan.Text), CollectionDay: If(IsBlank(mDay.Text), Blank(), Value(mDay.Text)), Status: {Value: "Active"}}); Reset(mBiz); Reset(mEmail); Reset(mPlan); Reset(mDay); Notify("Member added.", NotificationType.Success), Notify("Could not add the member. The e-mail may already be registered.", NotificationType.Error)))'))
write('members.pa.yaml', parts)
_DY = 0

# ---------- Book for a member (Screen9) ----------
Y0 = cy('Screen9')
B_START = 'DateAdd(bDate.SelectedDate, Value(Left(bStart.Text, 2)) * 60 + Value(Right(bStart.Text, 2)), TimeUnit.Minutes)'
B_END = 'DateAdd(bDate.SelectedDate, Value(Left(bEnd.Text, 2)) * 60 + Value(Right(bEnd.Text, 2)), TimeUnit.Minutes)'
TIME_OK = 'IsMatch(bStart.Text, "([01][0-9]|2[0-3]):[0-5][0-9]") && IsMatch(bEnd.Text, "([01][0-9]|2[0-3]):[0-5][0-9]")'
# Same availability rule as Requests (conflicts() above): an approved booking holding the same unit at an overlapping time blocks the booking.
B_IDS = 'Split(Concat(bEquip.SelectedItems, EquipmentId, ";"), ";")'
B_CONF = 'With({s: ' + B_START + ', e: ' + B_END + '}, ' + conflicts('s', 'e', B_IDS) + ')'
B_NCONF = 'If(' + TIME_OK + ' && bSpace.Selected.Value = "Kitchen" && CountRows(bEquip.SelectedItems) > 0, CountRows(' + B_CONF + '), 0)'
parts = nav('b', 'Screen9', 'Book on behalf of a member')
parts.append(panel('bPanelForm', 24, Y0, 640, 664))
parts.append(head('bFormHead', '"Booking details"', 44, Y0 + 12, 560, 20))
parts.append(label('bMemberLbl', '"Member"', 44, Y0 + 52, 300, 20, Size=11, Color=SUBTLE))
parts.append(ctl('bMember', 'Classic/DropDown', {'Items': 'ForAll(SortByColumns(Filter(AvenueMembers, FacilityId = ' + FAC + ', Status.Value = "Active"), "BusinessName", SortOrder.Ascending), {Value: BusinessName & " · " & MemberId, Id: MemberId})', 'X': 44, 'Y': Y0 + 74, 'Width': 600, 'Height': 36}))
parts.append(label('bSpaceLbl', '"What"', 44, Y0 + 120, 200, 20, Size=11, Color=SUBTLE))
parts.append(ctl('bSpace', 'Classic/DropDown', {'Items': '["Kitchen", "Dining", "Whole facility"]', 'Default': '"Kitchen"', 'X': 44, 'Y': Y0 + 142, 'Width': 280, 'Height': 36}))
parts.append(label('bDateLbl', '"Date, from, to (HH:MM, Eastern device)"', 44, Y0 + 188, 440, 20, Size=11, Color=SUBTLE))
parts.append(ctl('bDate', 'Classic/DatePicker', {'DefaultDate': 'Today()', 'X': 44, 'Y': Y0 + 210, 'Width': 280, 'Height': 36}))
parts.append(ctl('bStart', 'Classic/TextInput', {'Default': '"09:00"', 'X': 336, 'Y': Y0 + 210, 'Width': 140, 'Height': 36}))
parts.append(ctl('bEnd', 'Classic/TextInput', {'Default': '"13:00"', 'X': 488, 'Y': Y0 + 210, 'Width': 156, 'Height': 36}))
parts.append(label('bEquipLbl', '"Equipment (kitchen; Ctrl/Cmd-click to pick several)"', 44, Y0 + 256, 600, 20, Size=11, Color=SUBTLE, Visible='bSpace.Selected.Value = "Kitchen"'))
parts.append(ctl('bEquip', 'ListBox', {'Items': 'Filter(AvenueEquipment, FacilityId = ' + FAC + ')', 'SelectMultiple': 'true', 'X': 44, 'Y': Y0 + 278, 'Width': 600, 'Height': 204, 'Visible': 'bSpace.Selected.Value = "Kitchen"'}))
parts.append(ctl('bPeople', 'Classic/TextInput', {'Default': '""', 'HintText': '"Number of people"', 'Format': 'TextFormat.Number', 'X': 44, 'Y': Y0 + 278, 'Width': 280, 'Height': 36, 'Visible': 'bSpace.Selected.Value = "Dining"'}))
parts.append(label('bNoteLbl', '"Note to the member (optional)"', 44, Y0 + 498, 440, 20, Size=11, Color=SUBTLE))
parts.append(ctl('bNote', 'Classic/TextInput', {'Default': '""', 'HintText': '"Shown to the member with the outcome"', 'Mode': 'TextMode.MultiLine', 'X': 44, 'Y': Y0 + 520, 'Width': 600, 'Height': 88}))
B_CHECK = ('If(IsBlank(bMember.Selected), "Choose a member.", !(' + TIME_OK + '), "Enter times as HH:MM.", ' + B_END + ' <= ' + B_START + ', "The end must be after the start.", '
           + B_START + ' < Now(), "The start is in the past.", bSpace.Selected.Value = "Kitchen" && CountRows(bEquip.SelectedItems) = 0, "Choose the equipment.", '
           + 'bSpace.Selected.Value = "Dining" && !(Value(bPeople.Text) > 0), "Enter the number of people.", '
           + 'With({n: ' + B_NCONF + '}, If(n > 0, "Not available: " & ' + conflict_msg(B_CONF, B_IDS) + ' & If(n > 1, " (and " & (n - 1) & " more)", "") & ". Choose another time or unit.", '
           + 'If(CountRows(Filter(AvenueMemberDocuments, MemberId = bMember.Selected.Id, DocStatus.Value = "Expired", IsBlank(SupersededBy))) > 0 && IsBlank(LookUp(AvenueComplianceOverrides, MemberId = bMember.Selected.Id && Active = true)), "This member has an expired document that has not been renewed. Only the Flavors owner can override (the flow checks this too).", ""))))')
parts.append(panel('bPanelCheck', 680, Y0, 662, 664))
parts.append(head('bCheckHead', '"Availability and checks"', 700, Y0 + 12, 620, 20))
parts.append(hint('bHelp', '"Sent to the same checks as a member request (active member, documents, equipment, private events). Approved straight away if they pass. Times are in this device\'s time zone; use a device set to Eastern."', 700, Y0 + 50, 622, 52))
parts.append(label('bAvail', 'If(IsBlank(bCheck.Text), If(bSpace.Selected.Value = "Kitchen" && CountRows(bEquip.SelectedItems) > 0 && ' + TIME_OK + ', "Free: all " & CountRows(bEquip.SelectedItems) & " selected unit(s) are free at this time.", "Ready to book."), "")', 700, Y0 + 112, 622, 28, Size=13, FontWeight='FontWeight.Bold', Color=OKTEXT))
parts.append(label('bCheck', B_CHECK, 700, Y0 + 112, 622, 84, Size=13, FontWeight='FontWeight.Bold', Color=BAD, Visible='!IsBlank(Self.Text)'))
parts.append(label('bOverlap', 'If(' + TIME_OK + ', With({s: ' + B_START + ', e: ' + B_END + '}, With({n: CountRows(Filter(AvenueBookings, Status.Value = "Approved", StartUtc < e, EndUtc > s))}, If(n = 0, "No approved bookings at this time.", n & " approved booking(s) overlap this time (any equipment). Check Approved or Schedule before booking."))), "")', 700, Y0 + 204, 622, 44, Size=12, Color=SUBTLE))
parts.append(button('bCreate', 'Book', 700, Y0 + 268, 220, 48,
    'With({s: ' + B_START + ', e: ' + B_END + ', rid: "staff-" & Text(GUID())}, IfError(Patch(AvenueBookingRequests, Defaults(AvenueBookingRequests), {Title: "Staff booking", FacilityId: ' + FAC + ', RequestId: rid, Space: {Value: bSpace.Selected.Value}, EquipmentIds: If(bSpace.Selected.Value = "Kitchen", Concat(bEquip.SelectedItems, EquipmentId, ";"), ""), PeopleCount: If(bSpace.Selected.Value = "Dining", Value(bPeople.Text), Blank()), StartUtc: s, EndUtc: e, OnBehalfOf: bMember.Selected.Id, StaffNote: Trim(bNote.Text)}); Set(varLastReq, rid); Reset(bNote); Reset(bEquip); Reset(bPeople); Notify("Sent. Avenue checks it and books it within a minute; the result shows below.", NotificationType.Success), Notify("Could not send the booking request.", NotificationType.Error)))',
    DisplayMode='If(IsBlank(bCheck.Text), DisplayMode.Edit, DisplayMode.Disabled)', Size=14))
parts.append(head('bResHead', '"Result"', 700, Y0 + 340, 400, 16))
parts.append(label('bResult', 'If(IsBlank(varLastReq), "Nothing sent yet.", "Last request: " & Coalesce(LookUp(AvenueBookingRequests, RequestId = varLastReq).Outcome, "being checked (press Refresh in a minute)"))', 700, Y0 + 376, 622, 72, Size=12, Color=SUBTLE))
parts.append(button2('bRefresh', 'Refresh result', 700, Y0 + 456, 200, 40, 'Refresh(AvenueBookingRequests); Refresh(AvenueBookings)'))
write('book.pa.yaml', parts)

# ---------- Settings (Screen10) ----------
S_FAC = 'LookUp(AvenueFacilities, FacilityId = ' + FAC + ')'
parts = nav('s', 'Screen10', 'Settings')
_DY = cy('Screen10') - 60
parts.append(label('sHelp', '"Facility settings used by Avenue\'s automations. Defaults are proposals until Flavors confirms them (Q-10)."', 20, 60, 1300, 30, Size=12, Color='RGBA(96,94,92,1)'))
parts.append(label('sEntryLbl', '"Minutes after the start before a missing entry checklist is chased"', 20, 100, 640, 24, Size=12))
parts.append(ctl('sEntry', 'Classic/TextInput', {'Default': 'Text(' + S_FAC + '.EntryGraceMinutes)', 'Format': 'TextFormat.Number', 'X': 20, 'Y': 125, 'Width': 160, 'Height': 36}))
parts.append(label('sExitLbl', '"Minutes after the end before a missing exit checklist is chased"', 20, 170, 640, 24, Size=12))
parts.append(ctl('sExit', 'Classic/TextInput', {'Default': 'Text(' + S_FAC + '.ExitGraceMinutes)', 'Format': 'TextFormat.Number', 'X': 20, 'Y': 195, 'Width': 160, 'Height': 36}))
parts.append(label('sEmailLbl', '"Staff alert e-mail (new requests, failed and overdue checklists). Empty = no staff e-mails."', 20, 240, 900, 24, Size=12))
parts.append(ctl('sEmail', 'Classic/TextInput', {'Default': S_FAC + '.StaffAlertEmail', 'HintText': '"management@example.com"', 'X': 20, 'Y': 265, 'Width': 640, 'Height': 36}))
parts.append(button('sSave', 'Save settings', 20, 320, 200, 40,
    'If(!(Value(sEntry.Text) >= 0 && Value(sEntry.Text) <= 240 && Value(sExit.Text) >= 0 && Value(sExit.Text) <= 240), Notify("Minutes must be between 0 and 240.", NotificationType.Warning), !IsBlank(Trim(sEmail.Text)) && !IsMatch(Trim(sEmail.Text), Match.Email), Notify("Enter a valid e-mail or leave it empty.", NotificationType.Warning), IfError(Patch(AvenueFacilities, ' + S_FAC + ', {EntryGraceMinutes: Value(sEntry.Text), ExitGraceMinutes: Value(sExit.Text), StaffAlertEmail: Lower(Trim(sEmail.Text))}); Refresh(AvenueFacilities); Notify("Settings saved.", NotificationType.Success), Notify("Could not save the settings.", NotificationType.Error)))'))
write('settings.pa.yaml', parts)
_DY = 0


# ---------- Setup (Screen11): equipment, facility rules, plans / documents / hours ----------
Y0 = cy('Screen11')
Y1, H = Y0 + 56, 752 - (Y0 + 56)
parts = nav('u', 'Screen11', 'Setup')
EQ_VIS = 'Coalesce(varSetupTab, "equip") = "equip"'
RU_VIS = 'Coalesce(varSetupTab, "equip") = "rules"'
P_VIS = 'Coalesce(varSetupTab, "equip") = "plans"'
TB_VIS = 'Coalesce(varSetupTab, "equip") = "tables"'
TP_VIS = 'Coalesce(varSetupTab, "equip") = "topics"'
for i, (tid, cap, w, vis) in enumerate([('equip', 'Equipment', 168, EQ_VIS), ('rules', 'Facility rules', 168, RU_VIS), ('plans', 'Plans, documents, hours', 232, P_VIS),
                                        ('tables', 'Dining tables', 168, TB_VIS), ('topics', 'Support topics', 168, TP_VIS)]):
    x = 24 + [0, 176, 352, 592, 768][i]
    parts.append(button(f'uTab{tid.capitalize()}', cap, x, Y0, w, 40, f'Set(varSetupTab, "{tid}")', Fill=f'If({vis}, {OLIVE}, {SURFACE})', Color=f'If({vis}, {CREAM}, {OLIVE})',
                        BorderColor=OLIVE, BorderThickness=1, HoverFill=f'If({vis}, {OLIVE}, {CREAM})', HoverColor=f'If({vis}, {CREAM}, {OLIVE})', PressedFill=INK2, Size=13))

# ----- Tab 1: Equipment (master list left, edit form right) -----
_DY, _VIS = 0, EQ_VIS
CATS = '["Stove", "Grill", "Oven", "Warmer", "Pizza oven", "Fridge", "Mixer", "Prep table", "Other"]'
EQ_SEL = 'uEqGal.Selected'
parts.append(panel('uEqPanelList', 24, Y1, 520, H))
parts.append(head('uEqHead', '"Equipment units"', 44, Y1 + 12, 440, 16))
# Delegable: Filter on FacilityId + SortByColumns on the numeric SortOrder.
parts.append(gallery('uEqGal', 'SortByColumns(Filter(AvenueEquipment, FacilityId = ' + FAC + '), "SortOrder", SortOrder.Ascending)', 32, Y1 + 48, 504, H - 48 - 124, 72,
    thumb('uEqRow', 'ThisItem.PhotoUrl', 'Coalesce(ThisItem.Category.Value, ThisItem.Kind.Value)', 8, 10, 52) + [
    child('uEqItem', 'ThisItem.Title', 72, 10, 280, 26, FontWeight='FontWeight.Bold', Size=13),
    child('uEqCatLine', 'Coalesce(ThisItem.Category.Value, ThisItem.Kind.Value, "no category") & If(IsBlank(ThisItem.Location), "", " · " & ThisItem.Location)', 72, 38, 280, 22, Size=11, Color=SUBTLE),
    ('uEqFlags', 'Classic/Button', chip_props('If(!ThisItem.Active, "Inactive", If(IsBlank(ThisItem.BookableByMembers), "Bookable", If(ThisItem.BookableByMembers, "Bookable", "Staff only")))',
        'If(!ThisItem.Active, ' + BADTINT + ', If(ThisItem.BookableByMembers = false, ' + WAITTINT + ', ' + OKTINT + '))',
        'If(!ThisItem.Active, ' + BAD + ', If(ThisItem.BookableByMembers = false, ' + WAIT + ', ' + OKTEXT + '))', 372, 24, 120))]))
parts.append(head('uEqAddHead', '"Add a unit"', 44, Y1 + H - 112, 300, 14))
parts.append(ctl('uEqNew', 'Classic/TextInput', {'Default': '""', 'HintText': '"Name, e.g. Stove #3"', 'X': 44, 'Y': Y1 + H - 80, 'Width': 220, 'Height': 36}))
parts.append(ctl('uEqNewCat', 'Classic/DropDown', {'Items': CATS, 'Default': '"Stove"', 'X': 272, 'Y': Y1 + H - 80, 'Width': 140, 'Height': 36}))
parts.append(button('uEqAdd', 'Add', 420, Y1 + H - 80, 104, 36,
    'If(IsBlank(Trim(uEqNew.Text)), Notify("Enter the unit name.", NotificationType.Warning), IfError(Patch(AvenueEquipment, Defaults(AvenueEquipment), {Title: Left(Trim(uEqNew.Text), 255), FacilityId: ' + FAC + ', EquipmentId: Lower(Substitute(Trim(uEqNew.Text), " ", "-")), Kind: {Value: If(uEqNewCat.Selected.Value = "Prep table", "Prep table", "Equipment")}, Category: {Value: uEqNewCat.Selected.Value}, SortOrder: Coalesce(First(SortByColumns(Filter(AvenueEquipment, FacilityId = ' + FAC + '), "SortOrder", SortOrder.Descending)).SortOrder, 0) + 10, BookableByMembers: true, Active: true}); Reset(uEqNew); Notify("Unit added. Select it to add a description, photo and location.", NotificationType.Success), Notify("Could not add it. The id (name in lower case with dashes) may already exist: find it in the list and tick Active instead.", NotificationType.Error)))', Visible='(' + EQ_VIS + ') && ' + CAN('ManageEquipment')))
parts.append(hint('uEqHelp', '"The list is PARTIAL until the client\'s Equipment tab arrives (Q-B7). Names are what members see."', 44, Y1 + H - 36, 480, 28, Size=10))

parts.append(panel('uEqPanelEdit', 560, Y1, 782, H))
parts.append(head('uEqEditHead', 'If(IsBlank(' + EQ_SEL + '), "Select a unit to edit", "Edit: " & ' + EQ_SEL + '.Title)', 580, Y1 + 12, 740, 16))
# Preview of the typed photo link, else a neutral tile with an emoji for the category.
parts.append(ctl('uEqPrevImg', 'Image', {'Image': 'If(IsBlank(Trim(uEqPhoto.Text)), Blank(), Trim(uEqPhoto.Text))', 'X': 580, 'Y': Y1 + 56, 'Width': 96, 'Height': 96, 'Visible': '(' + EQ_VIS + ') && !IsBlank(Trim(uEqPhoto.Text))'}))
parts.append(label('uEqPrevTile', GLYPH.format(c='uEqCat.Selected.Value'), 580, Y1 + 56, 96, 96, Fill=MUTEDTINT, Color=OLIVE, Size=40, Align='Align.Center', VerticalAlign='VerticalAlign.Middle', Visible='(' + EQ_VIS + ') && IsBlank(Trim(uEqPhoto.Text))'))
parts.append(ctl('uEqTitle', 'Classic/TextInput', {'Default': EQ_SEL + '.Title', 'HintText': '"Name"', 'X': 692, 'Y': Y1 + 56, 'Width': 630, 'Height': 36, 'Size': 14}))
parts.append(ctl('uEqCat', 'Classic/DropDown', {'Items': CATS, 'Default': EQ_SEL + '.Category.Value', 'X': 692, 'Y': Y1 + 100, 'Width': 200, 'Height': 36}))
parts.append(ctl('uEqGroup', 'Classic/TextInput', {'Default': EQ_SEL + '.GroupId', 'HintText': '"Group id (e.g. convection-oven)"', 'X': 900, 'Y': Y1 + 100, 'Width': 250, 'Height': 36}))
parts.append(ctl('uEqSort', 'Classic/TextInput', {'Default': 'Text(' + EQ_SEL + '.SortOrder)', 'HintText': '"Sort order"', 'Format': 'TextFormat.Number', 'X': 1158, 'Y': Y1 + 100, 'Width': 164, 'Height': 36}))
parts.append(ctl('uEqDesc', 'Classic/TextInput', {'Default': EQ_SEL + '.Description', 'HintText': '"Description (members see it)"', 'Mode': 'TextMode.MultiLine', 'X': 580, 'Y': Y1 + 168, 'Width': 742, 'Height': 72}))
parts.append(ctl('uEqLoc', 'Classic/TextInput', {'Default': EQ_SEL + '.Location', 'HintText': '"Location"', 'X': 580, 'Y': Y1 + 252, 'Width': 280, 'Height': 36}))
parts.append(ctl('uEqPhoto', 'Classic/TextInput', {'Default': EQ_SEL + '.PhotoUrl', 'HintText': '"Photo URL: paste a hosted image link (https://...)"', 'X': 868, 'Y': Y1 + 252, 'Width': 454, 'Height': 36}))
parts.append(hint('uEqPhotoHelp', '"Photo: paste a link to an image hosted anywhere the members can open it. Empty shows a tile with a symbol for the category in both apps."', 580, Y1 + 292, 742, 36))
parts.append(label('uEqBookLbl', '"Bookable by members"', 580, Y1 + 340, 170, 30, Size=12))
parts.append(ctl('uEqBook', 'Classic/Toggle', {'Default': 'Coalesce(' + EQ_SEL + '.BookableByMembers, true)', 'X': 755, 'Y': Y1 + 340, 'Width': 95, 'Height': 30}))
parts.append(label('uEqActLbl', '"Active"', 865, Y1 + 340, 60, 30, Size=12))
parts.append(ctl('uEqActive', 'Classic/Toggle', {'Default': 'Coalesce(' + EQ_SEL + '.Active, true)', 'X': 930, 'Y': Y1 + 340, 'Width': 95, 'Height': 30}))
parts.append(button('uEqSave', 'Save unit', 580, Y1 + 392, 200, 44,
    'IfError(Patch(AvenueEquipment, ' + EQ_SEL + ', {Title: Left(Trim(uEqTitle.Text), 255), Category: {Value: uEqCat.Selected.Value}, Kind: {Value: If(uEqCat.Selected.Value = "Prep table", "Prep table", "Equipment")}, GroupId: Trim(uEqGroup.Text), SortOrder: If(IsBlank(Trim(uEqSort.Text)), Blank(), Value(uEqSort.Text)), Description: uEqDesc.Text, Location: Trim(uEqLoc.Text), PhotoUrl: Trim(uEqPhoto.Text), BookableByMembers: uEqBook.Value, Active: uEqActive.Value}); Refresh(AvenueEquipment); Notify("Unit saved.", NotificationType.Success), Notify("Could not save the unit.", NotificationType.Error))',
    DisplayMode='If(IsBlank(' + EQ_SEL + ') || IsBlank(Trim(uEqTitle.Text)) || IsBlank(uEqCat.Selected) || (!IsBlank(Trim(uEqSort.Text)) && !IsNumeric(uEqSort.Text)), DisplayMode.Disabled, DisplayMode.Edit)', Visible='(' + EQ_VIS + ') && ' + CAN('ManageEquipment')))
parts.append(hint('uEqSaveHelp', '"To retire a unit, untick Active and Save. It disappears from member booking but its history stays."', 580, Y1 + 444, 742, 24))

# ----- Tab 2: Facility rules (AvenueFacilities) -----
_VIS = RU_VIS
# Around a booking: early entry, clean-up, reminder (same fields the member portal reads) and the two check-in alert timings.
AROUND = [('uRuEarly', 'EarlyEntryMinutes', 'Early entry: minutes before the start', 'Free and not booked hours; does not block another booking that starts then.'),
          ('uRuClean', 'CleanupMinutes', 'Clean-up: minutes after the end', 'Free time to clean after the booked end; not charged.'),
          ('uRuAlert', 'CheckoutAlertMinutes', 'Clean-up reminder: minutes before the end', 'One reminder e-mail and an in-page banner with Extend.'),
          ('uRuEntry', 'EntryGraceMinutes', 'Entry check-in alert: minutes after the start', 'Chases a missing entry checklist. Not early entry.'),
          ('uRuExit', 'ExitGraceMinutes', 'Exit check-in alert: minutes after the end', 'Chases a missing exit checklist. Not clean-up time.')]
LIMITS = [('uRuMin', 'MinBookingMinutes', 'Minimum booking, minutes'), ('uRuMax', 'MaxBookingMinutes', 'Maximum booking, minutes'),
          ('uRuStep', 'BookingStepMinutes', 'Booking step, minutes'), ('uRuComp', 'MaxCompaniesInKitchen', 'Max companies in the kitchen at once'),
          ('uRuPrep', 'MinPrepTables', 'Minimum prep tables per company')]
RULES = [(n, f) for n, f, *_ in AROUND] + [(n, f) for n, f, _ in LIMITS]
parts.append(panel('uRuPanelAround', 24, Y1, 640, H))
parts.append(head('uRuHead', '"Around a booking"', 44, Y1 + 12, 560, 16))
for i, (nm, fld, cap, tip) in enumerate(AROUND):
    y = Y1 + 56 + i * 68
    parts.append(label(nm + 'Lbl', f'"{cap}"', 44, y, 600, 20, Size=12, FontWeight='FontWeight.Bold'))
    parts.append(ctl(nm, 'Classic/TextInput', {'Default': 'Text(' + S_FAC + '.' + fld + ')', 'HintText': '"Empty = not set"', 'Format': 'TextFormat.Number', 'X': 44, 'Y': y + 24, 'Width': 120, 'Height': 34}))
    parts.append(hint(nm + 'Tip', f'"{tip}"', 176, y + 26, 470, 32))
parts.append(label('uRuExample', '"Example: a booking 3:00 PM–6:00 PM. Members can come in from " & Text(DateAdd(Date(2026, 1, 1), 15 * 60 - If(IsNumeric(uRuEarly.Text), Value(uRuEarly.Text), 0), TimeUnit.Minutes), "h:mm AM/PM") & " and have until " & Text(DateAdd(Date(2026, 1, 1), 18 * 60 + If(IsNumeric(uRuClean.Text), Value(uRuClean.Text), 0), TimeUnit.Minutes), "h:mm AM/PM") & " to clean, not charged."',
                   44, Y1 + 56 + 5 * 68 + 8, 600, 48, Size=13, FontWeight='FontWeight.Bold', Color=OLIVE))
parts.append(panel('uRuPanelLimits', 680, Y1, 662, 352))
parts.append(head('uRuLimHead', '"Booking limits"', 700, Y1 + 12, 560, 16))
for i, (nm, fld, cap) in enumerate(LIMITS):
    y = Y1 + 52 + i * 58
    parts.append(label(nm + 'Lbl', f'"{cap}"', 700, y + 4, 330, 24, Size=12))
    parts.append(ctl(nm, 'Classic/TextInput', {'Default': 'Text(' + S_FAC + '.' + fld + ')', 'HintText': '"Empty = not set"', 'Format': 'TextFormat.Number', 'X': 1042, 'Y': y, 'Width': 120, 'Height': 34}))
parts.append(panel('uRuPanelAuto', 680, Y1 + 368, 662, H - 368))
parts.append(head('uRuAutoHead', '"Approval"', 700, Y1 + 380, 560, 16))
parts.append(label('uRuAutoLbl', '"Approve automatically when everything is free"', 700, Y1 + 420, 400, 28, Size=13, FontWeight='FontWeight.Bold'))
parts.append(ctl('uRuAuto', 'Classic/Toggle', {'Default': 'Coalesce(' + S_FAC + '.AutoApproveWhenFree, false)', 'X': 1120, 'Y': Y1 + 420, 'Width': 95, 'Height': 30}))
parts.append(label('uRuAutoHint', '"Needs client confirmation: the client approves every booking by hand. Leave off until they confirm. When on, only a request with free equipment, an active member and no expired document is approved automatically."', 700, Y1 + 456, 622, 64, Size=11, Color=WAIT))
RU_FIELDS = [n for n, _ in RULES]
RU_OK = ' && '.join(f'(IsBlank(Trim({n}.Text)) || (IsNumeric({n}.Text) && Value({n}.Text) >= 0))' for n in RU_FIELDS)
RU_RANGE = '!(!IsBlank(Trim(uRuMin.Text)) && !IsBlank(Trim(uRuMax.Text)) && Value(uRuMin.Text) > Value(uRuMax.Text)) && (IsBlank(Trim(uRuStep.Text)) || Value(uRuStep.Text) > 0)'
RU_SET = ', '.join(f'{fld}: If(IsBlank(Trim({n}.Text)), Blank(), Value({n}.Text))' for n, fld in RULES) + ', AutoApproveWhenFree: uRuAuto.Value'
parts.append(button('uRuSave', 'Save rules', 700, Y1 + H - 64, 220, 44,
    'If(!(' + RU_OK + '), Notify("Each rule must be empty or a number from 0 up.", NotificationType.Warning), !(' + RU_RANGE + '), Notify("Minimum cannot be above maximum, and the step must be above 0.", NotificationType.Warning), IfError(Patch(AvenueFacilities, ' + S_FAC + ', {' + RU_SET + '}); Refresh(AvenueFacilities); Notify("Rules saved. Members see the new times in the portal.", NotificationType.Success), Notify("Could not save the rules.", NotificationType.Error)))'))
parts.append(hint('uRuHelp', '"Empty means not set; nothing is assumed (Q-B1 to Q-B8). The member portal reads these same fields."', 932, Y1 + H - 62, 400, 40, Size=10))

# ----- Tab 3: Plans, required documents, hours adjustment (original content, shifted under the tab row) -----
_VIS = P_VIS
parts.append(panel('uPlanPanelL', 16, Y1, 656, 440))
parts.append(panel('uPlanPanelR', 680, Y1, 662, H))
_DY = Y1 - 56
PL_SEL = 'uPlanGal.Selected'
parts.append(label('uPlanHead', '"Plans (select one to load it; inactive plans are greyed)"', 20, 60, 640, 30, FontWeight='FontWeight.Semibold'))
# All plans, active first. Remove = Active false (members keep their plan id); Reactivate turns it back on. Plans are never deleted.
parts.append(gallery('uPlanGal', 'SortByColumns(Filter(AvenuePlans, FacilityId = ' + FAC + '), "Active", SortOrder.Descending, "PlanId", SortOrder.Ascending)', 20, 95, 640, 190, 40, [
    child('uPlanItem', 'If(ThisItem.Active, "", "INACTIVE · ") & ThisItem.PlanId & " · " & ThisItem.MonthlyHours & " h · " & If(IsBlank(ThisItem.PriceCents), "price not set", "$" & Text(ThisItem.PriceCents / 100, "#,##0") & " bank / $" & Text(Coalesce(ThisItem.CardPriceCents, 0) / 100, "#,##0") & " card") & " · " & Coalesce(ThisItem.PlanGroup.Value, "-") & If(ThisItem.OpenToNew = false, " · closed to new", "")', 8, 6, 480, 28,
          Size=11, Color='If(ThisItem.Active, ' + TEXT + ', ' + SUBTLE + ')'),
    ('uPlanRemove', 'Classic/Button', {'Text': 'If(ThisItem.Active, "Remove", "Reactivate")', 'X': 500, 'Y': 3, 'Width': 120, 'Height': 34, 'Visible': CAN('ManageMembers'),
        'OnSelect': 'IfError(Patch(AvenuePlans, LookUp(AvenuePlans, PlanId = ThisItem.PlanId), {Active: !ThisItem.Active}); Notify(If(ThisItem.Active, "Plan removed: hidden from new members, existing members keep it.", "Plan reactivated."), NotificationType.Information), Notify("Could not save the plan.", NotificationType.Error))'})]))
parts.append(ctl('uPlanId', 'Classic/TextInput', {'Default': 'Coalesce(' + PL_SEL + '.PlanId, "")', 'HintText': '"Plan id"', 'X': 20, 'Y': 295, 'Width': 150, 'Height': 36}))
parts.append(ctl('uPlanHours', 'Classic/TextInput', {'Default': 'If(IsBlank(' + PL_SEL + '), "", Text(' + PL_SEL + '.MonthlyHours))', 'HintText': '"Hours / month"', 'Format': 'TextFormat.Number', 'X': 180, 'Y': 295, 'Width': 120, 'Height': 36}))
parts.append(ctl('uPlanRate', 'Classic/TextInput', {'Default': 'If(IsBlank(' + PL_SEL + '.ExtraHourRate), "", Text(' + PL_SEL + '.ExtraHourRate))', 'HintText': '"$ per extra hour"', 'Format': 'TextFormat.Number', 'X': 310, 'Y': 295, 'Width': 130, 'Height': 36}))
parts.append(ctl('uPlanGroup', 'Classic/DropDown', {'Items': '["Emerging", "Mobile Kitchen", "Legacy"]', 'Default': 'Coalesce(' + PL_SEL + '.PlanGroup.Value, "Emerging")', 'X': 450, 'Y': 295, 'Width': 210, 'Height': 36}))
parts.append(ctl('uPlanPrice', 'Classic/TextInput', {'Default': 'If(IsBlank(' + PL_SEL + '.PriceCents), "", Text(' + PL_SEL + '.PriceCents / 100, "0.00"))', 'HintText': '"$ a month (bank)"', 'X': 20, 'Y': 341, 'Width': 150, 'Height': 36}))
parts.append(ctl('uPlanCard', 'Classic/TextInput', {'Default': 'If(IsBlank(' + PL_SEL + '.CardPriceCents), "", Text(' + PL_SEL + '.CardPriceCents / 100, "0.00"))', 'HintText': '"$ a month (card)"', 'X': 180, 'Y': 341, 'Width': 150, 'Height': 36}))
parts.append(label('uPlanOpenLbl', '"Open to new members"', 340, 341, 160, 36, Size=12, VerticalAlign='VerticalAlign.Middle'))
parts.append(ctl('uPlanOpen', 'Classic/Toggle', {'Default': 'Coalesce(' + PL_SEL + '.OpenToNew, true)', 'X': 500, 'Y': 344, 'Width': 90, 'Height': 30}))
PL_MONEY = lambda n: '(IsBlank(Trim(' + n + '.Text)) || (IsNumeric(' + n + '.Text) && Value(' + n + '.Text) >= 0))'
PL_CENTS = lambda n: 'If(IsBlank(Trim(' + n + '.Text)), Blank(), Round(Value(' + n + '.Text) * 100, 0))'
parts.append(button('uPlanSave', 'Save plan', 20, 387, 160, 36,
    'If(IsBlank(Trim(uPlanId.Text)) || !IsNumeric(uPlanHours.Text), Notify("Enter a plan id and its hours per month.", NotificationType.Warning), !(' + PL_MONEY('uPlanPrice') + ' && ' + PL_MONEY('uPlanCard') + ' && ' + PL_MONEY('uPlanRate') + '), Notify("Prices and the rate must be empty or a number from 0 up.", NotificationType.Warning), '
    'IfError(Patch(AvenuePlans, Coalesce(LookUp(AvenuePlans, PlanId = Trim(uPlanId.Text)), Defaults(AvenuePlans)), {Title: Trim(uPlanId.Text), FacilityId: ' + FAC + ', PlanId: Trim(uPlanId.Text), MonthlyHours: Value(uPlanHours.Text), ExtraHourRate: If(IsBlank(uPlanRate.Text), Blank(), Value(uPlanRate.Text)), '
    'PriceCents: ' + PL_CENTS('uPlanPrice') + ', CardPriceCents: ' + PL_CENTS('uPlanCard') + ', PlanGroup: {Value: uPlanGroup.Selected.Value}, OpenToNew: uPlanOpen.Value, Active: true}); Notify("Plan saved. An existing id is updated.", NotificationType.Success), Notify("Could not save the plan.", NotificationType.Error)))',
    Visible='(' + P_VIS + ') && ' + CAN('ManageMembers')))
parts.append(label('uPlanHelp', '"Prices come from the client sheet (card = bank + 3 %, Q-M1). Changing a price here does not change Stripe prices or existing subscriptions (STR-06, Q-R2). Type a new id to add a plan."', 190, 383, 470, 50, Size=10, Color=SUBTLE))
parts.append(label('uReqHead', '"Required documents (every active member)"', 690, 60, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(label('uReqHelp', '"Leave empty until Flavors decides (Q-11). Nothing is assumed."', 690, 90, 640, 24, Size=11, Color='RGBA(96,94,92,1)'))
parts.append(gallery('uReqGal', 'Filter(AvenueRequiredDocTypes, FacilityId = ' + FAC + ', Active = true)', 690, 118, 640, 110, 36, [
    child('uReqItem', 'ThisItem.DocType.Value', 8, 4, 480, 28),
    ('uReqRemove', 'Classic/Button', {'Text': '"Remove"', 'X': 500, 'Y': 1, 'Width': 120, 'Height': 32, 'OnSelect': 'Patch(AvenueRequiredDocTypes, ThisItem, {Active: false}); Notify("No longer required.", NotificationType.Information)'})]))
parts.append(ctl('uReqType', 'Classic/DropDown', {'Items': DOC_TYPES, 'X': 690, 'Y': 236, 'Width': 220, 'Height': 36}))
parts.append(button('uReqAdd', 'Require', 920, 236, 120, 36,
    'If(!IsBlank(LookUp(AvenueRequiredDocTypes, DocType.Value = uReqType.Selected.Value && Active = true)), Notify("Already required.", NotificationType.Warning), IfError(Patch(AvenueRequiredDocTypes, Defaults(AvenueRequiredDocTypes), {Title: uReqType.Selected.Value, FacilityId: ' + FAC + ', DocType: {Value: uReqType.Selected.Value}, Active: true}); Notify("Now required.", NotificationType.Success), Notify("Could not save.", NotificationType.Error)))'))
REQ_GAP = 'Filter(Filter(AvenueRequiredDocTypes, Active = true) As r, IsBlank(LookUp(AvenueMemberDocuments, MemberId = ThisItem.MemberId && DocType.Value = r.DocType.Value && IsBlank(SupersededBy) && DocStatus.Value <> "Expired")))'
parts.append(label('uMissHead', '"Members missing or expired on a required document"', 690, 285, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(gallery('uMissGal',
    'Filter(Filter(AvenueMembers, FacilityId = ' + FAC + ', Status.Value = "Active") As m, CountRows(Filter(Filter(AvenueRequiredDocTypes, Active = true) As r, IsBlank(LookUp(AvenueMemberDocuments, MemberId = m.MemberId && DocType.Value = r.DocType.Value && IsBlank(SupersededBy) && DocStatus.Value <> "Expired")))) > 0)',
    690, 318, 640, 140, 40, [
    child('uMissName', 'Coalesce(ThisItem.BusinessName, ThisItem.MemberId)', 8, 4, 280, 28, FontWeight='FontWeight.Semibold'),
    child('uMissWhat', 'Concat(' + REQ_GAP + ', DocType.Value, ", ")', 290, 4, 330, 28, Size=12, Color='RGBA(164,38,44,1)')]))
parts.append(label('uAdjHead', '"Hours adjustment (staff or owner; recorded with who and why)"', 690, 470, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(ctl('uAdjMember', 'Classic/DropDown', {'Items': 'ForAll(SortByColumns(Filter(AvenueMembers, FacilityId = ' + FAC + '), "BusinessName", SortOrder.Ascending), {Value: BusinessName & " · " & MemberId, Id: MemberId})', 'X': 690, 'Y': 505, 'Width': 640, 'Height': 36}))
parts.append(ctl('uAdjHours', 'Classic/TextInput', {'Default': '""', 'HintText': '"Hours (+ add used, - give back)"', 'Format': 'TextFormat.Number', 'X': 690, 'Y': 550, 'Width': 200, 'Height': 36}))
parts.append(ctl('uAdjWhy', 'Classic/TextInput', {'Default': '""', 'HintText': '"Reason (required)"', 'X': 900, 'Y': 550, 'Width': 430, 'Height': 36}))
parts.append(button('uAdjSave', 'Record adjustment', 690, 598, 220, 38,
    'With({id: "adj-" & Text(GUID())}, IfError(Patch(AvenueHoursLedger, Defaults(AvenueHoursLedger), {Title: "Adjustment", FacilityId: ' + FAC + ', EntryId: id, ChargeKey: id, MemberId: uAdjMember.Selected.Id, BookingId: "", Period: ' + EPERIOD + ', Hours: Value(uAdjHours.Text), Reason: {Value: "Adjustment"}, Note: Trim(uAdjWhy.Text) & " (by " & User().Email & ")"}); Reset(uAdjHours); Reset(uAdjWhy); Notify("Adjustment recorded.", NotificationType.Success), Notify("Could not record the adjustment.", NotificationType.Error)))',
    DisplayMode='If(IsBlank(uAdjMember.Selected) || !IsNumeric(uAdjHours.Text) || Value(uAdjHours.Text) = 0 || IsBlank(Trim(uAdjWhy.Text)), DisplayMode.Disabled, DisplayMode.Edit)'))
parts.append(label('uAdjHelp', '"Counts in the staff dashboard hours. The member portal counts approved bookings, so it does not show adjustments yet."', 690, 642, 640, 40, Size=11, Color='RGBA(96,94,92,1)'))
_DY = 0

# ----- Tab 4: Dining tables (AvenueDiningTables, catalog). Never deleted: untick Active to retire. -----
_VIS = TB_VIS
TB_SEL = 'uTbGal.Selected'
parts.append(panel('uTbPanelList', 24, Y1, 520, H))
parts.append(head('uTbHead', '"Dining tables"', 44, Y1 + 12, 440, 16))
parts.append(gallery('uTbGal', 'SortByColumns(Filter(AvenueDiningTables, FacilityId = ' + FAC + '), "TableId", SortOrder.Ascending)', 32, Y1 + 48, 504, H - 64, 48, [
    child('uTbItem', 'ThisItem.TableId & " · " & Coalesce(Text(ThisItem.Seats), "?") & " seats" & If(ThisItem.Active, "", " · INACTIVE")', 8, 8, 460, 30, Color='If(ThisItem.Active, ' + TEXT + ', ' + SUBTLE + ')')]))
parts.append(panel('uTbPanelEdit', 560, Y1, 782, 300))
parts.append(head('uTbEditHead', '"Add or edit a table (select one on the left to load it)"', 580, Y1 + 12, 740, 16))
parts.append(ctl('uTbId', 'Classic/TextInput', {'Default': 'Coalesce(' + TB_SEL + '.TableId, "")', 'HintText': '"Table id, e.g. table-1"', 'X': 580, 'Y': Y1 + 56, 'Width': 260, 'Height': 36}))
parts.append(ctl('uTbSeats', 'Classic/TextInput', {'Default': 'If(IsBlank(' + TB_SEL + '), "", Text(' + TB_SEL + '.Seats))', 'HintText': '"Seats"', 'Format': 'TextFormat.Number', 'X': 850, 'Y': Y1 + 56, 'Width': 120, 'Height': 36}))
parts.append(label('uTbActLbl', '"Active"', 990, Y1 + 56, 60, 36, Size=12, VerticalAlign='VerticalAlign.Middle'))
parts.append(ctl('uTbActive', 'Classic/Toggle', {'Default': 'Coalesce(' + TB_SEL + '.Active, true)', 'X': 1050, 'Y': Y1 + 59, 'Width': 90, 'Height': 30}))
parts.append(button('uTbSave', 'Save table', 580, Y1 + 108, 180, 40,
    'If(IsBlank(Trim(uTbId.Text)) || !IsNumeric(uTbSeats.Text) || Value(uTbSeats.Text) < 1, Notify("Enter a table id and a seat count from 1.", NotificationType.Warning), IfError(Patch(AvenueDiningTables, Coalesce(LookUp(AvenueDiningTables, TableId = Lower(Trim(uTbId.Text))), Defaults(AvenueDiningTables)), '
    '{Title: Lower(Trim(uTbId.Text)), FacilityId: ' + FAC + ', TableId: Lower(Trim(uTbId.Text)), Seats: Value(uTbSeats.Text), Active: uTbActive.Value}); Notify("Table saved. An existing id is updated.", NotificationType.Success), Notify("Could not save the table.", NotificationType.Error)))',
    Visible='(' + TB_VIS + ') && ' + CAN('ManageEquipment')))
parts.append(hint('uTbHelp', '"Seat counts come from the client (Q-22: about 50 seats with the current set-up). To retire a table untick Active and Save; it is kept."', 580, Y1 + 160, 740, 40))

# ----- Tab 5: Support topics (AvenueSupportCategories). The member portal and the support flow read the Active titles. -----
_VIS = TP_VIS
TP_SEL = 'uTpGal.Selected'
TP_USED = 'CountRows(Filter(AvenueSupportCases, FacilityId = ' + FAC + ', Category.Value = ' + TP_SEL + '.Title))'
parts.append(panel('uTpPanelList', 24, Y1, 520, H))
parts.append(head('uTpHead', '"Support topics members can choose"', 44, Y1 + 12, 440, 16))
parts.append(gallery('uTpGal', 'SortByColumns(Filter(AvenueSupportCategories, FacilityId = ' + FAC + '), "SortOrder", SortOrder.Ascending)', 32, Y1 + 48, 504, H - 64, 48, [
    child('uTpItem', 'Text(ThisItem.SortOrder) & ". " & ThisItem.Title & If(ThisItem.Active, "", " · hidden")', 8, 8, 460, 30, Color='If(ThisItem.Active, ' + TEXT + ', ' + SUBTLE + ')')]))
parts.append(panel('uTpPanelEdit', 560, Y1, 782, 340))
parts.append(head('uTpEditHead', 'If(IsBlank(' + TP_SEL + '), "Add a topic", "Edit: " & ' + TP_SEL + '.Title)', 580, Y1 + 12, 740, 16))
parts.append(ctl('uTpTitle', 'Classic/TextInput', {'Default': 'Coalesce(' + TP_SEL + '.Title, "")', 'HintText': '"Topic, e.g. Billing"', 'X': 580, 'Y': Y1 + 56, 'Width': 300, 'Height': 36}))
parts.append(ctl('uTpOrder', 'Classic/TextInput', {'Default': 'If(IsBlank(' + TP_SEL + '), "", Text(' + TP_SEL + '.SortOrder))', 'HintText': '"Order"', 'Format': 'TextFormat.Number', 'X': 890, 'Y': Y1 + 56, 'Width': 100, 'Height': 36}))
parts.append(label('uTpActLbl', '"Shown to members"', 1000, Y1 + 56, 140, 36, Size=12, VerticalAlign='VerticalAlign.Middle'))
parts.append(ctl('uTpActive', 'Classic/Toggle', {'Default': 'Coalesce(' + TP_SEL + '.Active, true)', 'X': 1140, 'Y': Y1 + 59, 'Width': 90, 'Height': 30}))
TP_OK = '!IsBlank(Trim(uTpTitle.Text)) && IsNumeric(uTpOrder.Text)'
# A topic in use keeps its title (cases store the text they were sent with), so Save refuses a rename then.
parts.append(button('uTpSave', 'Save changes', 580, Y1 + 108, 170, 40,
    'If(' + TP_USED + ' > 0 && Trim(uTpTitle.Text) <> ' + TP_SEL + '.Title, Notify("Cases use this topic, so it cannot be renamed. Hide it and add a new topic instead.", NotificationType.Warning), IfError(Patch(AvenueSupportCategories, LookUp(AvenueSupportCategories, ID = ' + TP_SEL + '.ID), {Title: Left(Trim(uTpTitle.Text), 255), SortOrder: Value(uTpOrder.Text), Active: uTpActive.Value}); Notify("Topic saved.", NotificationType.Success), Notify("Could not save the topic.", NotificationType.Error)))',
    DisplayMode='If(!IsBlank(' + TP_SEL + ') && ' + TP_OK + ', DisplayMode.Edit, DisplayMode.Disabled)'))
parts.append(button2('uTpAdd', 'Add as new topic', 760, Y1 + 108, 190, 40,
    'If(!IsBlank(LookUp(AvenueSupportCategories, FacilityId = ' + FAC + ' && Title = Trim(uTpTitle.Text))), Notify("That topic already exists.", NotificationType.Warning), IfError(Patch(AvenueSupportCategories, Defaults(AvenueSupportCategories), {Title: Left(Trim(uTpTitle.Text), 255), FacilityId: ' + FAC + ', SortOrder: Value(uTpOrder.Text), Active: uTpActive.Value}); Notify("Topic added.", NotificationType.Success), Notify("Could not add the topic.", NotificationType.Error)))',
    DisplayMode='If(' + TP_OK + ', DisplayMode.Edit, DisplayMode.Disabled)'))
# Delete: owner only (UI gate, not security) and only when no support case uses the topic; otherwise hide it (Active off).
parts.append(button('uTpDelete', 'Delete (owner, unused only)', 960, Y1 + 108, 260, 40,
    'If(' + TP_USED + ' > 0, Notify("Cases use this topic: untick Shown to members instead.", NotificationType.Warning), IfError(Remove(AvenueSupportCategories, LookUp(AvenueSupportCategories, ID = ' + TP_SEL + '.ID)); Notify("Topic deleted.", NotificationType.Information), Notify("Could not delete the topic.", NotificationType.Error)))',
    DisplayMode='If(!IsBlank(' + TP_SEL + ') && ' + TP_USED + ' = 0, DisplayMode.Edit, DisplayMode.Disabled)', Visible='(' + TP_VIS + ') && ' + OWNER_SN_EARLY,
    Fill=SURFACE, Color=BAD, BorderColor=BAD, BorderThickness=1, HoverFill=BADTINT, HoverColor=BAD, PressedFill=BADTINT))
parts.append(hint('uTpHelp', 'If(IsBlank(' + TP_SEL + '), "", Text(' + TP_USED + ') & " support cases use this topic. ") & "A topic in use cannot be renamed or deleted (cases keep the text they were sent with); hide it instead. The support flow accepts only topics shown to members."', 580, Y1 + 160, 740, 56))
_DY, _VIS = 0, None
write('setup.pa.yaml', parts)


# ---------- Schedule board (Screen19): one day, equipment units down the side, that day's approved bookings per unit ----------
# Facility time zone is America/New_York (helpers f_local / f_day_start above).
Y0 = cy('Screen19')
Y1, H = Y0 + 56, 752 - (Y0 + 56)
WEEK = 'Coalesce(varScheduleWeek, false)'
MONTH = 'Coalesce(varSchedMonth, false)'
SCH_DAY = 'Coalesce(varSchedDay, Today())'
# Delegable part: Filter on FacilityId, Status, StartUtc, EndUtc inside With(). The equipment match below it runs locally on that one day.
SCH_DAY_BOOKINGS = 'With({s: ' + f_day_start(SCH_DAY) + ', e: ' + f_day_start('DateAdd(' + SCH_DAY + ', 1, TimeUnit.Days)') + '}, Filter(AvenueBookings, FacilityId = ' + FAC + ', Status.Value = "Approved", StartUtc < e, EndUtc > s))'
SCH_ON_UNIT = 'Filter(' + SCH_DAY_BOOKINGS + ' As b, b.Space.Value = "Whole facility" || CountRows(Filter(Split(b.EquipmentIds, ";"), Trim(Value) = schUnits.Selected.Id)) > 0)'
MSTART = 'DateAdd(' + SCH_DAY + ', 1 - Day(' + SCH_DAY + '), TimeUnit.Days)'
GSTART = 'DateAdd(' + MSTART + ', -(Weekday(' + MSTART + ') - 1), TimeUnit.Days)'
# The grid shows 42 days from GSTART; the data covers 42 days either side too, so a click on a next- or last-month day shows real counts.
LOADM = 'ClearCollect(colMonth, With({s: ' + f_day_start(GSTART) + ', e: ' + f_day_start('DateAdd(' + GSTART + ', 42, TimeUnit.Days)') + '}, Filter(AvenueBookings, FacilityId = ' + FAC + ', Status.Value = "Approved", StartUtc < DateAdd(e, 42, TimeUnit.Days), EndUtc > DateAdd(s, -42, TimeUnit.Days))))'
parts = nav('sch', 'Screen19', 'Schedule')
parts.append(ctl('schDate', 'Classic/DatePicker', {'DefaultDate': SCH_DAY, 'OnChange': 'Set(varSchedDay, schDate.SelectedDate); If(' + MONTH + ', ' + LOADM + ')', 'X': 24, 'Y': Y0, 'Width': 200, 'Height': 40}))
parts.append(button2('schPrev', 'x', 232, Y0, 88, 40, 'Set(varSchedDay, If(' + MONTH + ', DateAdd(' + SCH_DAY + ', -1, TimeUnit.Months), DateAdd(' + SCH_DAY + ', If(' + WEEK + ', -7, -1), TimeUnit.Days))); If(' + MONTH + ', ' + LOADM + ')', Text='If(' + MONTH + ', "← Month", If(' + WEEK + ', "← Week", "← Day"))'))
parts.append(button2('schToday', 'Today', 328, Y0, 88, 40, 'Set(varSchedDay, Today()); If(' + MONTH + ', ' + LOADM + ')'))
parts.append(button2('schNextDay', 'x', 424, Y0, 88, 40, 'Set(varSchedDay, If(' + MONTH + ', DateAdd(' + SCH_DAY + ', 1, TimeUnit.Months), DateAdd(' + SCH_DAY + ', If(' + WEEK + ', 7, 1), TimeUnit.Days))); If(' + MONTH + ', ' + LOADM + ')', Text='If(' + MONTH + ', "Month →", If(' + WEEK + ', "Week →", "Day →"))'))
parts.append(button2('schRefresh', 'Refresh', 520, Y0, 96, 40, 'Refresh(AvenueBookings); Refresh(AvenueEquipment); Refresh(AvenueMembers); Refresh(AvenueFacilities); If(' + MONTH + ', ' + LOADM + ')'))
parts.append(label('schDayHead', 'If(' + MONTH + ', Text(' + SCH_DAY + ', "mmmm yyyy"), If(' + WEEK + ', "Seven days from " & Text(' + SCH_DAY + ', "ddd d mmm"), Text(' + SCH_DAY + ', "dddd d mmmm yyyy"))) & "  ·  Eastern time"', 632, Y0, 220, 40, Size=14, FontWeight='FontWeight.Bold', Color=INK, VerticalAlign='VerticalAlign.Middle'))
parts.append(button('schMonthView', 'Calendar', 862, Y0, 150, 40, 'Set(varSchedMonth, true); Set(varScheduleWeek, false); ' + LOADM, Fill=f'If({MONTH}, {OLIVE}, {SURFACE})', Color=f'If({MONTH}, {CREAM}, {OLIVE})', BorderColor=OLIVE, BorderThickness=1, HoverFill=CREAM, HoverColor=OLIVE))
parts.append(button('schDayView', 'Day by equipment', 1022, Y0, 160, 40, 'Set(varScheduleWeek, false); Set(varSchedMonth, false)', Fill=f'If({WEEK} || {MONTH}, {SURFACE}, {OLIVE})', Color=f'If({WEEK} || {MONTH}, {OLIVE}, {CREAM})', BorderColor=OLIVE, BorderThickness=1, HoverFill=CREAM, HoverColor=OLIVE))
parts.append(button('schWeekView', '7-day overview', 1182, Y0, 160, 40, 'Set(varScheduleWeek, true); Set(varSchedMonth, false)', Fill=f'If({WEEK} && !{MONTH}, {OLIVE}, {SURFACE})', Color=f'If({WEEK} && !{MONTH}, {CREAM}, {OLIVE})', BorderColor=OLIVE, BorderThickness=1, HoverFill=CREAM, HoverColor=OLIVE))
_VIS = '!' + WEEK + ' && !' + MONTH
parts.append(panel('schPanelUnits', 24, Y1, 520, H))
parts.append(head('schUnitHead', '"Equipment"', 44, Y1 + 12, 300, 16))
parts.append(hint('schUnitHelp', '"Select a unit. The tag shows how many approved bookings it has that day."', 44, Y1 + 40, 480, 20, Size=10))
# Rows = active units by SortOrder (delegable). N counts that day's bookings per unit locally.
parts.append(gallery('schUnits',
    'With({day: ' + SCH_DAY_BOOKINGS + '}, ForAll(SortByColumns(Filter(AvenueEquipment, FacilityId = ' + FAC + ', Active = true), "SortOrder", SortOrder.Ascending) As q, {Id: q.EquipmentId, Name: q.Title, Cat: q.Category.Value, Photo: q.PhotoUrl, N: CountRows(Filter(day As b, b.Space.Value = "Whole facility" || CountRows(Filter(Split(b.EquipmentIds, ";"), Trim(Value) = q.EquipmentId)) > 0))}))',
    32, Y1 + 68, 504, H - 76, 64,
    thumb('schUnit', 'ThisItem.Photo', 'ThisItem.Cat', 8, 8, 48) + [
     child('schUnitName', 'ThisItem.Name', 68, 8, 310, 24, FontWeight='FontWeight.Bold', Size=13),
     child('schUnitCat', 'Coalesce(ThisItem.Cat, "Equipment")', 68, 34, 310, 20, Size=11, Color=SUBTLE),
     pill('schUnitN', 'If(ThisItem.N = 0, "Free", ThisItem.N & If(ThisItem.N = 1, " booking", " bookings"))', 'If(ThisItem.N = 0, ' + OKTINT + ', ' + WAITTINT + ')', 'If(ThisItem.N = 0, ' + OKTEXT + ', ' + WAIT + ')', 384, 18, 108)]))
parts.append(panel('schPanelBook', 560, Y1, 782, H))
parts.append(head('schBookHead', 'If(IsBlank(schUnits.Selected), "Select a unit", schUnits.Selected.Name)', 580, Y1 + 12, 740, 16))
parts.append(hint('schBookSub', '"Approved bookings that day: when the member may come in, the booked time, and the free clean-up window."', 580, Y1 + 40, 740, 20, Size=10))
parts.append(gallery('schBookings', 'SortByColumns(' + SCH_ON_UNIT + ', "StartUtc", SortOrder.Ascending)', 568, Y1 + 68, 766, H - 68 - 76, 96, [
    child('schWho', 'Coalesce(LookUp(AvenueMembers, MemberId = ThisItem.MemberId).BusinessName, ThisItem.MemberId)', 8, 8, 560, 28, FontWeight='FontWeight.Bold', Size=14),
    status_chip('schChip', 'ThisItem.Status.Value', 620, 10, 128),
    child('schWhen', f_window('ThisItem.StartUtc', 'Coalesce(ThisItem.ActualEndUtc, ThisItem.EndUtc)') + ' & If(IsBlank(ThisItem.ActualEndUtc), "", " (departure corrected)")', 8, 40, 740, 24, Size=12),
    child('schStatus', 'If(Now() < ThisItem.StartUtc, "Upcoming", If(Now() < Coalesce(ThisItem.ActualEndUtc, ThisItem.EndUtc), "In progress", "Finished")) & " · " & ThisItem.Space.Value & If(IsBlank(ThisItem.CancelRequestedAt), "", " · cancel requested") & If(ThisItem.ExtensionDecision = "Pending", " · extra time requested", "")', 8, 66, 740, 22, Size=11, Color=SUBTLE)]))
parts.append(label('schEmpty', 'If(!IsBlank(schUnits.Selected) && CountRows(schBookings.AllItems) = 0, "No approved bookings for this unit on this day.", "")', 580, Y1 + H - 68, 740, 28, Size=12, Color=SUBTLE))
parts.append(hint('schNote', '"Whole-facility bookings show on every unit. Times are facility time. Pending requests are not shown here; they are on Requests."', 580, Y1 + H - 36, 740, 28, Size=10))
_VIS = WEEK + ' && !' + MONTH
parts.append(panel('schPanelWeek', 24, Y1, 1318, H))
parts.append(head('schWeekHead', '"The week at a glance"', 44, Y1 + 12, 900, 20))
parts.append(hint('schWeekHelp', '"Approved bookings · select a date for the equipment view · Eastern time"', 44, Y1 + 46, 1240, 22))
for i in range(7):
    week_day = 'DateAdd(' + SCH_DAY + ', ' + str(i) + ', TimeUnit.Days)'
    week_next = 'DateAdd(' + SCH_DAY + ', ' + str(i + 1) + ', TimeUnit.Days)'
    week_items = 'With({s: ' + f_day_start(week_day) + ', e: ' + f_day_start(week_next) + '}, Filter(AvenueBookings, FacilityId = ' + FAC + ', Status.Value = "Approved", StartUtc < e, EndUtc > s))'
    x = 40 + 184 * i
    parts.append(button('schWeekDay' + str(i), 'x', x, Y1 + 76, 176, 40, 'Set(varSchedDay, ' + week_day + '); Set(varScheduleWeek, false)', Text='Text(' + week_day + ', "ddd d mmm")', Fill=OLIVE, Color=CREAM, HoverFill=INK2, Size=12))
    parts.append(gallery('schWeekBookings' + str(i), 'SortByColumns(' + week_items + ', "StartUtc", SortOrder.Ascending)', x, Y1 + 124, 176, H - 124 - 48, 100, [
        child('schWeekTime' + str(i), f_local('ThisItem.StartUtc', 'h:mm AM/PM') + ' & " – " & ' + f_local('Coalesce(ThisItem.ActualEndUtc, ThisItem.EndUtc)', 'h:mm AM/PM'), 6, 4, 150, 22, Size=10, FontWeight='FontWeight.Bold'),
        child('schWeekMember' + str(i), 'Coalesce(LookUp(AvenueMembers, MemberId = ThisItem.MemberId).BusinessName, ThisItem.MemberId)', 6, 28, 150, 22, Size=10),
        child('schWeekDetails' + str(i), 'ThisItem.Space.Value & If(IsBlank(ThisItem.EquipmentIds), "", " · " & Substitute(ThisItem.EquipmentIds, ";", ", "))', 6, 52, 150, 44, Size=9, Color=SUBTLE)]))
parts.append(hint('schWeekNote', '"Showing approved bookings only. Pending requests remain in Requests. Verify large-list limits before operational use."', 44, Y1 + H - 36, 1240, 24, Size=10))
_VIS = MONTH
parts.append(panel('schPanelMonth', 24, Y1, 1318, H))
parts.append(head('schMonthHead', '"Shared calendar"', 44, Y1 + 12, 600, 20))
parts.append(hint('schMonthHelp', '"Approved bookings only. Select a day to see who has what. Eastern time."', 44, Y1 + 46, 860, 22, Size=10))
for c, nm in enumerate(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']):
    parts.append(label('schMonthDow' + str(c), '"' + nm + '"', 44 + 126 * c, Y1 + 76, 122, 22, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE, Align='Align.Center'))
for r in range(6):
    for c in range(7):
        d = 'DateAdd(' + GSTART + ', ' + str(r * 7 + c) + ', TimeUnit.Days)'
        n = 'CountRows(Filter(colMonth, StartUtc < ' + f_day_start('DateAdd(' + d + ', 1, TimeUnit.Days)') + ', EndUtc > ' + f_day_start(d) + '))'
        sel = 'Text(' + d + ', "yyyymmdd") = Text(' + SCH_DAY + ', "yyyymmdd")'
        parts.append(button('schMonthCell' + str(r * 7 + c), 'x', 44 + 126 * c, Y1 + 102 + 74 * r, 122, 68, 'Set(varSchedDay, ' + d + ')',
            Text='Text(Day(' + d + ')) & If(' + n + ' > 0, Char(10) & ' + n + ' & If(' + n + ' = 1, " booking", " bookings"), "")',
            Fill='If(' + sel + ', ' + OLIVE + ', If(' + n + ' > 0, ' + OKTINT + ', ' + SURFACE + '))',
            Color='If(' + sel + ', ' + CREAM + ', If(Month(' + d + ') <> Month(' + SCH_DAY + '), ' + SUBTLE + ', ' + TEXT + '))',
            BorderColor=BORDER, BorderThickness=1, HoverFill=CREAM, HoverColor=OLIVE, Size=11))
parts.append(head('schMonthDayHead', 'Text(' + SCH_DAY + ', "dddd d mmmm")', 944, Y1 + 76, 380, 16))
parts.append(gallery('schMonthDay', 'SortByColumns(' + SCH_DAY_BOOKINGS + ', "StartUtc", SortOrder.Ascending)', 944, Y1 + 108, 386, H - 108 - 60, 92, [
    child('schMonthWho', 'Coalesce(LookUp(AvenueMembers, MemberId = ThisItem.MemberId).BusinessName, ThisItem.MemberId)', 8, 6, 360, 24, FontWeight='FontWeight.Bold', Size=13),
    child('schMonthWhen', f_window('ThisItem.StartUtc', 'Coalesce(ThisItem.ActualEndUtc, ThisItem.EndUtc)'), 8, 32, 360, 22, Size=11),
    child('schMonthWhat', 'ThisItem.Space.Value & If(IsBlank(ThisItem.EquipmentIds), "", " · " & Substitute(ThisItem.EquipmentIds, ";", ", "))', 8, 56, 360, 30, Size=10, Color=SUBTLE)]))
parts.append(label('schMonthEmpty', 'If(CountRows(schMonthDay.AllItems) = 0, "No approved bookings this day. The kitchen is free.", "")', 944, Y1 + H - 52, 380, 28, Size=11, Color=SUBTLE))
_VIS = None
write('schedule.pa.yaml', parts)


# ---------- Requests (Screen1): waiting requests left, details and decision right ----------
Y0 = cy('Screen1')
SEL = 'galQueue.Selected'
RQ_IDS = 'Split(' + SEL + '.EquipmentIds, ";")'
# Prep tables and the fridge are interchangeable and assigned by the portal from approved bookings only, so two waiting
# requests often carry the same ones. They are not compared by id; Approve assigns free ones (RQ_ALLOC) and refuses when too few are free.
RQ_CAT = 'LookUp(AvenueEquipment, EquipmentId = Trim(Value)).Category.Value'
RQ_FIXED = 'Filter(' + RQ_IDS + ', !(' + RQ_CAT + ' in ["Prep table", "Fridge"]))'
RQ_CONF = conflicts(SEL + '.StartUtc', SEL + '.EndUtc', RQ_FIXED, fac=SEL + '.FacilityId')
RQ_HELD = 'ForAll(Split(Concat(Filter(AvenueBookings, FacilityId = ' + SEL + '.FacilityId, Status.Value = "Approved", StartUtc < ' + SEL + '.EndUtc, EndUtc > ' + SEL + '.StartUtc), EquipmentIds & ";"), ";"), Trim(Value))'
RQ_FREE = 'Sort(Filter(AvenueEquipment, FacilityId = ' + SEL + '.FacilityId, Category.Value = "{c}", Active = true, !(EquipmentId in held)), ThisRecord.SortOrder)'
RQ_SPACE = ('CountRows(Filter(AvenueBookings, FacilityId = ' + SEL + '.FacilityId, Status.Value = "Approved", StartUtc < ' + SEL + '.EndUtc, EndUtc > ' + SEL + '.StartUtc, '
            'Space.Value = "Whole facility" || ' + SEL + '.Space.Value = "Whole facility" || (Space.Value = "Dining" && ' + SEL + '.Space.Value = "Dining"))) > 0')
def rq_with(body):
    return ('With({held: ' + RQ_HELD + '}, With({nPrep: CountRows(Filter(' + RQ_IDS + ', ' + RQ_CAT + ' = "Prep table")), wantFridge: CountRows(Filter(' + RQ_IDS + ', ' + RQ_CAT + ' = "Fridge")) > 0, '
            'freePrep: ' + RQ_FREE.format(c='Prep table') + ', freeFridge: ' + RQ_FREE.format(c='Fridge') + ', clash: ' + RQ_SPACE + ', past: ' + SEL + '.StartUtc < Now()}, ' + body + '))')
RQ_WHY = ('If(past, "This request\'s start time has passed. Decline it.", clash, "The dining room or the whole facility is booked then.", CountRows(freePrep) < nPrep, "Only " & CountRows(freePrep) & " prep tables are free then.", '
          'wantFridge && CountRows(freeFridge) = 0, "Both refrigerators are in use then.", "")')
RQ_N = 'CountRows(' + RQ_CONF + ')'
BIZ = 'Coalesce(LookUp(AvenueMembers, MemberId = {m}).BusinessName, {m})'
parts = nav('rq', 'Screen1', 'Requests · waiting for approval')
parts.append(panel('rqPanelList', 24, Y0, 520, 664))
parts.append(label('lblQueueHead', '"Waiting for approval · " & CountRows(Filter(AvenueBookings, Status.Value = "Pending"))', 44, Y0 + 10, 380, 32, Size=16, FontWeight='FontWeight.Bold', Color=INK, VerticalAlign='VerticalAlign.Middle'))
parts.append(button2('btnRefresh', 'Refresh', 440, Y0 + 10, 88, 32, 'Refresh(AvenueBookings); Refresh(AvenueCalendar); Refresh(AvenueEquipment); Refresh(AvenueFacilities)', Size=11))
parts.append(gallery('galQueue', 'SortByColumns(Filter(AvenueBookings, Status.Value = "Pending"), "StartUtc", SortOrder.Ascending)', 32, Y0 + 52, 504, 604, 88, [
    child('lblRowMember', BIZ.format(m='ThisItem.MemberId'), 8, 6, 350, 24, FontWeight='FontWeight.Bold', Size=13),
    status_chip('rqRowChip', 'ThisItem.Status.Value', 366, 8, 128),
    child('lblRowWhen', f_when('ThisItem.StartUtc', 'ThisItem.EndUtc') + ' & " · " & ThisItem.Space.Value & If(ThisItem.Space.Value = "Dining", " · " & ThisItem.PeopleCount & " people", "")', 8, 32, 486, 20, Size=11),
    child('lblRowWin', f_window('ThisItem.StartUtc', 'ThisItem.EndUtc', short=True), 8, 56, 486, 20, Size=10, Color=SUBTLE)]))
parts.append(panel('rqPanelDetail', 560, Y0, 782, 664))
parts.append(label('rqEmpty', '"Select a request on the left to see the details and decide."', 580, Y0 + 260, 742, 60, Size=16, Color=SUBTLE, Align='Align.Center', Visible='IsBlank(' + SEL + ')'))
V = '!IsBlank(' + SEL + ')'
parts.append(label('lblDetailHead', BIZ.format(m=SEL + '.MemberId'), 580, Y0 + 14, 590, 36, Size=20, FontWeight='FontWeight.Bold', Color=INK, Visible=V))
parts.append(ctl('rqDetChip', 'Classic/Button', dict(status_chip('x', SEL + '.Status.Value', 1194, Y0 + 20, 128)[2], Visible=V)))
parts.append(label('lblDetail', '"Space: " & ' + SEL + '.Space.Value & If(' + SEL + '.Space.Value = "Dining", " · " & ' + SEL + '.PeopleCount & " people", "") & Char(10) & "When: " & ' + f_when(SEL + '.StartUtc', SEL + '.EndUtc') +
                   ' & Char(10) & "Entry and clean-up: " & ' + f_window(SEL + '.StartUtc', SEL + '.EndUtc') + ' & Char(10) & "Equipment: " & Concat(Split(' + SEL + '.EquipmentIds, ";"), Coalesce(LookUp(AvenueEquipment, EquipmentId = Trim(Value)).Title, Value), ", ") & Char(10) & "Member: " & ' + SEL + '.MemberId',
                   580, Y0 + 56, 742, 108, Size=12, Visible=V, VerticalAlign='VerticalAlign.Top'))
parts.append(head('lblOverlapHead', '"Approved bookings at the same time (you decide whether an overlap is acceptable)"', 580, Y0 + 172, 742, 12, Visible=V))
parts.append(gallery('galOverlap', 'Filter(AvenueCalendar, FacilityId = ' + SEL + '.FacilityId, StartUtc < ' + SEL + '.EndUtc, EndUtc > ' + SEL + '.StartUtc)', 580, Y0 + 204, 742, 96, 48, [
    child('lblOverlapRow', 'ThisItem.MemberDisplayName & " · " & ThisItem.Space.Value & If(!IsBlank(ThisItem.EquipmentIds), " · " & Concat(Split(ThisItem.EquipmentIds, ";"), Coalesce(LookUp(AvenueEquipment, EquipmentId = Trim(Value)).Title, Value), ", "), "") & " · " & ' + f_local('ThisItem.StartUtc', 'h:mm AM/PM') + ' & "–" & ' + f_local('ThisItem.EndUtc', 'h:mm AM/PM') +
          ' & If(ThisItem.Space.Value = "Whole facility" || ' + SEL + '.Space.Value = "Whole facility" || CountRows(Filter(Split(ThisItem.EquipmentIds, ";"), Trim(Value) in Split(' + SEL + '.EquipmentIds, ";"))) > 0, "  ◄ same equipment or whole facility", "")', 8, 4, 722, 40, Size=11)], Visible=V))
parts.append(label('lblConflictHead', 'With({n: ' + RQ_N + '}, If(n = 0, "No equipment conflict with an approved booking", n & " conflict(s) with approved bookings: resolve before approving"))', 580, Y0 + 308, 742, 26, Size=13, FontWeight='FontWeight.Bold',
                   Color='If(' + RQ_N + ' = 0, ' + OKTEXT + ', ' + BAD + ')', Visible=V))
parts.append(gallery('galConflicts', RQ_CONF, 580, Y0 + 336, 742, 72, 36, [
    child('lblConflictRow', 'Concat(Filter(Split(ThisItem.EquipmentIds, ";"), Trim(Value) in ' + RQ_FIXED + '), Coalesce(LookUp(AvenueEquipment, EquipmentId = Trim(Value)).Title, Trim(Value)), ", ") & " is booked by " & Coalesce(LookUp(AvenueCalendar, BookingId = ThisItem.BookingId).MemberDisplayName, ThisItem.MemberId) & " until " & ' + f_local('ThisItem.EndUtc', 'h:mm AM/PM'),
          8, 2, 722, 32, Size=12, Color=BAD)], Visible=V))
parts.append(ctl('txtNote', 'Classic/TextInput', {'Visible': V, 'HintText': '"Note about this decision (recorded with the booking)"', 'Mode': 'TextMode.MultiLine', 'Default': '""', 'X': 580, 'Y': Y0 + 420, 'Width': 742, 'Height': 80}))
parts.append(button('btnApprove', 'Approve', 580, Y0 + 516, 200, 48,
    rq_with('If(' + RQ_N + ' > 0 || past || clash || CountRows(freePrep) < nPrep || (wantFridge && CountRows(freeFridge) = 0), Notify("This request cannot be approved as it stands. Decline it with a reason.", NotificationType.Warning), '
            'IfError(Patch(AvenueBookings, ' + SEL + ', {Status: {Value: "Approved"}, DecidedBy: User().Email, DecidedAt: Now(), OverlapNote: txtNote.Text, '
            'EquipmentIds: With({ids: Concat(' + RQ_FIXED + ', Trim(Value) & ";") & Concat(FirstN(freePrep, nPrep), EquipmentId & ";") & If(wantFridge, First(freeFridge).EquipmentId, "")}, If(Right(ids, 1) = ";", Left(ids, Len(ids) - 1), ids))}); '
            'Reset(txtNote); Notify("Approved. It appears on the shared calendar shortly.", NotificationType.Success), Notify("Could not approve the request. Try again.", NotificationType.Error)))'),
    Visible=V, DisplayMode=rq_with('If(' + RQ_N + ' > 0 || past || clash || CountRows(freePrep) < nPrep || (wantFridge && CountRows(freeFridge) = 0), DisplayMode.Disabled, DisplayMode.Edit)'), Size=14))
parts.append(button2('btnDecline', 'Decline', 792, Y0 + 516, 160, 48,
    'Patch(AvenueBookings, ' + SEL + ', {Status: {Value: "Declined"}, DecidedBy: User().Email, DecidedAt: Now(), OverlapNote: txtNote.Text}); Reset(txtNote); Notify("Declined.", NotificationType.Information)',
    Visible=V, Size=14, Color=BAD, BorderColor=BAD, HoverFill=BADTINT, HoverColor=BAD, HoverBorderColor=BAD, PressedFill=BADTINT))
parts.append(label('lblConflictMsg', 'With({n: ' + RQ_N + '}, If(n = 0, ' + rq_with(RQ_WHY) + ', "Resolve the conflict first: " & ' + conflict_msg(RQ_CONF, RQ_FIXED) + ' & If(n > 1, " (and " & (n - 1) & " more)", "")))', 964, Y0 + 512, 358, 56, Size=12, FontWeight='FontWeight.Bold', Color=BAD, Visible=V))
parts.append(ctl('tmrQueueRefresh', 'Timer', {'AutoStart': 'true', 'AutoPause': 'true', 'Duration': 15000, 'Repeat': 'true', 'Visible': 'false', 'OnTimerEnd': 'Refresh(AvenueBookings); Refresh(AvenueCalendar)'}))
write('requests.pa.yaml', parts)

# ---------- Approved (Screen2): approved bookings left, details, cancel, no-show, adjust departure right ----------
Y0 = cy('Screen2')
SA = 'galApproved.Selected'
VA = '!IsBlank(' + SA + ')'
ADJ_OK_TIME = 'IsMatch(apAdjTime.Text, "([01][0-9]|2[0-3]):[0-5][0-9]")'
# The corrected departure is a time on the booking's (Eastern) end day: 00:00 Eastern of that day + HH:MM. [PROPOSED] same-day only.
ADJ_AT = 'With({d: DateValue(' + f_local(SA + '.EndUtc', 'yyyy-mm-dd') + ')}, DateAdd(' + f_day_start('d') + ', Value(Left(apAdjTime.Text, 2)) * 60 + Value(Right(apAdjTime.Text, 2)), TimeUnit.Minutes))'
ADJ_OK = VA + ' && ' + ADJ_OK_TIME + ' && !IsBlank(Trim(apAdjWhy.Text)) && ' + ADJ_AT + ' > ' + SA + '.StartUtc'
parts = nav('ap', 'Screen2', 'Approved bookings')
parts.append(panel('apPanelList', 24, Y0, 520, 664))
parts.append(label('lblApprovedHead', '"Approved · " & CountRows(Filter(AvenueBookings, Status.Value = "Approved"))', 44, Y0 + 10, 380, 32, Size=16, FontWeight='FontWeight.Bold', Color=INK, VerticalAlign='VerticalAlign.Middle'))
parts.append(button2('btnRefresh2', 'Refresh', 440, Y0 + 10, 88, 32, 'Refresh(AvenueBookings); Refresh(AvenueFacilities)', Size=11))
parts.append(gallery('galApproved', 'SortByColumns(Filter(AvenueBookings, Status.Value = "Approved"), "StartUtc", SortOrder.Ascending)', 32, Y0 + 52, 504, 604, 88, [
    child('lblAppRow1', BIZ.format(m='ThisItem.MemberId'), 8, 6, 330, 24, FontWeight='FontWeight.Bold', Size=13),
    pill('apRowChip', 'If(!IsBlank(ThisItem.CancelRequestedAt), "Cancel requested", "Approved")', 'If(!IsBlank(ThisItem.CancelRequestedAt), ' + WAITTINT + ', ' + OKTINT + ')', 'If(!IsBlank(ThisItem.CancelRequestedAt), ' + WAIT + ', ' + OKTEXT + ')', 346, 8, 148),
    child('lblAppRow2', f_when('ThisItem.StartUtc', 'Coalesce(ThisItem.ActualEndUtc, ThisItem.EndUtc)') + ' & " · " & ThisItem.Space.Value', 8, 32, 486, 20, Size=11),
    child('lblAppRow3', f_window('ThisItem.StartUtc', 'Coalesce(ThisItem.ActualEndUtc, ThisItem.EndUtc)', short=True) + ' & If(IsBlank(ThisItem.ActualEndUtc), "", " · departure corrected")', 8, 56, 486, 20, Size=10, Color=SUBTLE)]))
parts.append(panel('apPanelDetail', 560, Y0, 782, 664))
parts.append(label('apEmpty', '"Select a booking on the left."', 580, Y0 + 120, 742, 40, Size=16, Color=SUBTLE, Align='Align.Center', Visible='IsBlank(' + SA + ')'))
parts.append(label('apDetHead', BIZ.format(m=SA + '.MemberId'), 580, Y0 + 14, 590, 36, Size=20, FontWeight='FontWeight.Bold', Color=INK, Visible=VA))
parts.append(ctl('apDetChip', 'Classic/Button', dict(status_chip('x', SA + '.Status.Value', 1194, Y0 + 20, 128)[2], Visible=VA)))
parts.append(label('lblSel', '"Space: " & ' + SA + '.Space.Value & Char(10) & "When: " & ' + f_when(SA + '.StartUtc', 'Coalesce(' + SA + '.ActualEndUtc, ' + SA + '.EndUtc)') + ' & Char(10) & "Entry and clean-up: " & ' + f_window(SA + '.StartUtc', 'Coalesce(' + SA + '.ActualEndUtc, ' + SA + '.EndUtc)') + ' & Char(10) & If(!IsBlank(' + SA + '.CancelRequestedAt), "Cancel request: " & Coalesce(LookUp(AvenueBookingRequests, CancelBookingId = ' + SA + '.BookingId && !IsBlank(Message)).Message, "no message"), "Member: " & ' + SA + '.MemberId)',
                   580, Y0 + 56, 742, 88, Size=12, Visible=VA, VerticalAlign='VerticalAlign.Top'))
parts.append(ctl('txtNote2', 'Classic/TextInput', {'Visible': VA, 'HintText': '"Note (recorded with the booking)"', 'Mode': 'TextMode.MultiLine', 'Default': '""', 'X': 580, 'Y': Y0 + 152, 'Width': 742, 'Height': 56}))
parts.append(button2('btnCancel', 'Cancel booking (hours return)', 580, Y0 + 220, 260, 44,
    'Patch(AvenueBookings, ' + SA + ', {Status: {Value: "Cancelled"}, DecidedBy: User().Email, DecidedAt: Now(), OverlapNote: txtNote2.Text}); Reset(txtNote2); Notify("Cancelled. Hours are returned and the calendar entry is removed shortly.", NotificationType.Success)',
    Visible=VA, Color=BAD, BorderColor=BAD, HoverFill=BADTINT, HoverColor=BAD, HoverBorderColor=BAD, PressedFill=BADTINT))
# One button, two jobs (as live): no-show credit, or, on an under-24 h cancel request, cancel without returning hours
# ("Cancelled (hours kept)" is not credited by the hours-ledger flow).
CR = '!IsBlank(' + SA + '.CancelRequestedAt)'
parts.append(button2('btnNoShow', '', 852, Y0 + 220, 260, 44,
    'If(' + CR + ', If(IsBlank(Trim(txtNote2.Text)), Notify("Write the reason for the member in the note first.", NotificationType.Warning), IfError(Patch(AvenueBookings, ' + SA + ', {Status: {Value: "Cancelled (hours kept)"}, CancelRequestedAt: Blank(), DecidedBy: User().Email, DecidedAt: Now(), OverlapNote: Trim(txtNote2.Text)}); Reset(txtNote2); Notify("Cancelled. The hours stay used.", NotificationType.Success), Notify("Could not update the booking.", NotificationType.Error))), Patch(AvenueBookings, ' + SA + ', {Status: {Value: "No-show credited"}, DecidedBy: User().Email, DecidedAt: Now(), OverlapNote: txtNote2.Text}); Reset(txtNote2); Notify("No-show credited. Hours are returned.", NotificationType.Success))',
    Visible=VA, Text='If(' + CR + ', "Cancel, keep hours", "No-show: credit hours back")'))
# Refuse an under-24 h cancel request (live control name: Button1): clears CancelRequestedAt; the echo flow then shows the member "Approved · Note: <reason>".
parts.append(button2('btnKeep', 'Keep booking', 1124, Y0 + 220, 198, 44,
    'If(IsBlank(Trim(txtNote2.Text)), Notify("Write the reason for the member in the note first.", NotificationType.Warning), IfError(Patch(AvenueBookings, ' + SA + ', {CancelRequestedAt: Blank(), OverlapNote: Trim(txtNote2.Text)}); Reset(txtNote2); Notify("Booking kept. The member sees your note.", NotificationType.Success), Notify("Could not update the booking.", NotificationType.Error)))',
    Visible=VA + ' && !IsBlank(' + SA + '.CancelRequestedAt)', Size=13))
parts.append(label('apDiv1', '""', 580, Y0 + 276, 742, 1, Fill=BORDER))
parts.append(head('apAdjHead', '"Adjust departure"', 580, Y0 + 284, 742, 14, Visible=VA))
parts.append(hint('apAdjHelp', '"When a member leaves later or earlier than booked, record the real departure (same day as the booked end, Eastern HH:MM). The hours ledger then uses it instead of the booked end."', 580, Y0 + 312, 742, 36, Visible=VA))
parts.append(ctl('apAdjTime', 'Classic/TextInput', {'Visible': VA, 'HintText': '"HH:MM"', 'Default': '""', 'X': 580, 'Y': Y0 + 352, 'Width': 100, 'Height': 36}))
parts.append(ctl('apAdjWhy', 'Classic/TextInput', {'Visible': VA, 'HintText': '"Reason (required), e.g. left 6:40 PM per camera"', 'Default': '""', 'X': 690, 'Y': Y0 + 352, 'Width': 470, 'Height': 36}))
parts.append(button('apAdjBtn', 'Adjust departure', 1170, Y0 + 352, 152, 36,
    'With({tt: ' + ADJ_AT + ', b: ' + SA + '}, IfError(Patch(AvenueBookings, b, {ActualEndUtc: tt, OverlapNote: Trim(Coalesce(b.OverlapNote, "") & " · Departure corrected to " & ' + f_local('tt', 'h:mm AM/PM') + ' & " by " & User().Email & ": " & Trim(apAdjWhy.Text))}); Reset(apAdjTime); Reset(apAdjWhy); Refresh(AvenueBookings); Notify("Departure recorded. The hours ledger uses it.", NotificationType.Success), Notify("Could not record the departure.", NotificationType.Error)))',
    Visible=VA, DisplayMode='If(' + ADJ_OK + ', DisplayMode.Edit, DisplayMode.Disabled)', Size=11))
parts.append(label('apAdjMsg', 'If(' + VA + ' && ' + ADJ_OK_TIME + ', "Will be recorded as " & ' + f_local(ADJ_AT, 'h:mm AM/PM') + ' & " (booked end " & ' + f_local(SA + '.EndUtc', 'h:mm AM/PM') + ' & ")", "") & If(' + VA + ' && !IsBlank(' + SA + '.ActualEndUtc), "  ·  currently corrected to " & ' + f_local(SA + '.ActualEndUtc', 'h:mm AM/PM') + ', "")', 580, Y0 + 392, 742, 22, Size=11, Color=SUBTLE))
parts.append(label('apDiv2', '""', 580, Y0 + 420, 742, 1, Fill=BORDER))
# ---------- Extra time (BKG-08), lower part of the Approved detail panel, inside its scrolling page so it follows any window size ----------
X_END = 'DateAdd(DateValue(Text(galApproved.Selected.EndUtc, "yyyy-mm-dd")), Value(Left(xNewEnd.Text, 2)) * 60 + Value(Right(xNewEnd.Text, 2)), TimeUnit.Minutes)'
X_OK = '!IsBlank(galApproved.Selected) && IsMatch(xNewEnd.Text, "([01][0-9]|2[0-3]):[0-5][0-9]") && ' + X_END + ' > galApproved.Selected.EndUtc && galApproved.Selected.ExtensionDecision <> "Pending"'
parts.append(head('xHead', '"Extra time requests (members)"', 580, Y0 + 428, 742, 14))
parts.append(gallery('xGal', 'SortByColumns(Filter(AvenueBookings, ExtensionDecision = "Pending"), "ExtensionRequestedAt", SortOrder.Ascending)', 580, Y0 + 456, 742, 84, 56, [
    child('xRow1', 'ThisItem.MemberId & " · " & ThisItem.Space.Value & " · ends " & Text(ThisItem.EndUtc, "ddd d mmm, h:mm AM/PM") & " → " & Text(ThisItem.ExtensionTo, "h:mm AM/PM")', 8, 4, 722, 26, FontWeight='FontWeight.Bold'),
    child('xRow2', 'ThisItem.ExtensionConflict', 8, 30, 722, 24, Size=11, Color='If(StartsWith(ThisItem.ExtensionConflict, "No other"), ' + SUBTLE + ', ' + BAD + ')')]))
parts.append(button('xApprove', 'Approve extra time', 580, Y0 + 546, 220, 36,
    'Patch(AvenueBookings, xGal.Selected, {ExtensionDecision: "Approved", ExtendedBy: User().Email, ExtendedAt: Now()}); Notify("Approved. The booking, calendar and hours update and the member is e-mailed within a minute.", NotificationType.Success)',
    DisplayMode='If(IsBlank(xGal.Selected), DisplayMode.Disabled, DisplayMode.Edit)'))
parts.append(button2('xDecline', 'Decline', 812, Y0 + 546, 140, 36,
    'Patch(AvenueBookings, xGal.Selected, {ExtensionDecision: "Declined", ExtendedBy: User().Email, ExtendedAt: Now()}); Notify("Declined. The member is e-mailed.", NotificationType.Information)',
    DisplayMode='If(IsBlank(xGal.Selected), DisplayMode.Disabled, DisplayMode.Edit)', Color=BAD, BorderColor=BAD, HoverFill=BADTINT, HoverColor=BAD, HoverBorderColor=BAD, PressedFill=BADTINT))
parts.append(label('xStaffHead', '"Extend the selected booking (staff or owner): new end, HH:MM, same day"', 580, Y0 + 590, 742, 20, Size=12, FontWeight='FontWeight.Bold'))
parts.append(ctl('xNewEnd', 'Classic/TextInput', {'Default': '""', 'HintText': '"HH:MM"', 'X': 580, 'Y': Y0 + 612, 'Width': 100, 'Height': 36}))
parts.append(button2('xExtendNow', 'Extend now', 690, Y0 + 612, 140, 36,
    'With({e: ' + X_END + ', b: galApproved.Selected}, Patch(AvenueBookings, b, {ExtensionTo: e, ExtensionRequestedAt: Now(), ExtensionRequestId: "staff-" & Text(GUID()), ExtensionConflict: If(CountRows(Filter(AvenueBookings, Status.Value = "Approved", BookingId <> b.BookingId, StartUtc < e, EndUtc > b.EndUtc)) > 0, "Extended by staff over an overlapping booking", "No other approved booking in the extra time"), ExtensionDecision: "Approved", ExtendedBy: User().Email, ExtendedAt: Now()}); Reset(xNewEnd); Notify("Extended. The calendar and hours update and the member is e-mailed within a minute.", NotificationType.Success))',
    DisplayMode='If(' + X_OK + ', DisplayMode.Edit, DisplayMode.Disabled)'))
parts.append(label('xExtOverlap', 'If(' + X_OK + ', With({e: ' + X_END + ', b: galApproved.Selected}, With({n: CountRows(Filter(AvenueBookings, Status.Value = "Approved", BookingId <> b.BookingId, StartUtc < e, EndUtc > b.EndUtc))}, If(n = 0, "No other approved booking in the extra time.", n & " approved booking(s) overlap the extra time."))), "")', 842, Y0 + 612, 480, 36, Size=11, Color=SUBTLE))
write('approved.pa.yaml', parts)



# ---------- More Hub (Screen12) ----------
Y0 = cy('Screen12')
parts = nav('mor', 'Screen12', 'More')
parts.append(head('morHead', '"More features and administration"', 24, Y0, 800, 20))
hub_cards = [
    ('Setup (Screen11)', 'Navigate(Screen11)', 'Equipment, facility rules, plans, required documents, and hours adjustments.'),
    ('Payments (Screen13)', 'Navigate(Screen13)', 'Review member invoices, payment statuses, and billing records.'),
    ('Sensors (Screen14)', 'Navigate(Screen14)', 'Monitor refrigerator and freezer temperatures and telemetry.'),
    ('Support (Screen15)', 'Navigate(Screen15)', 'Messages from members: read, reply and close.'),
    ('Applicants (Screen16)', 'Navigate(Screen16)', 'Review prospective member applications and onboarding progress.'),
    ('Permissions (Screen17)', 'Navigate(Screen17)', 'Owner only: which staff may use which screens.'),
    ('Reports (Screen18)', 'Navigate(Screen18)', 'Bookings and hours per month, documents, invoices and equipment use.'),
    ('Events (Screen21)', 'Navigate(Screen21)', 'Private-event and dining requests: approve, quote and request the invoices.'),
    ('Storage (Screen22)', 'Navigate(Screen22)', 'Fridge, freezer and dry-storage requests from members.'),
    ('Member admin (Screen23)', 'Navigate(Screen23)', 'Edit members, hours ledger, documents on a member\'s behalf, team list.')
]
hub_cards = [c for c in hub_cards if on(HUB_MODULE[re.search(r'Screen\d+', c[1]).group()])]
for i, (title, target, desc) in enumerate(hub_cards):
    col, row = i % 3, i // 3
    x, y = 24 + col * 436, Y0 + 52 + row * 120
    parts.append(button(f'morBtn{i}', '', x, y, 420, 104, target, Fill=SURFACE, HoverFill=CREAM, PressedFill=MUTEDTINT, BorderColor=BORDER, HoverBorderColor=OLIVE, BorderThickness=1, Text='""', RadiusTopLeft=12, RadiusTopRight=12, RadiusBottomLeft=12, RadiusBottomRight=12))
    parts.append(label(f'morTitle{i}', f'"{title}"', x + 20, y + 14, 380, 28, Size=15, FontWeight='FontWeight.Bold', Color=INK, OnSelect=target))
    parts.append(label(f'morDesc{i}', f'"{desc}"', x + 20, y + 46, 380, 48, Size=11, Color=SUBTLE, OnSelect=target))
write('more.pa.yaml', parts)


# ---------- Payments (Screen13): Invoices (Stripe mirror, test mode) | Expected (from plans and hours) ----------
PRICE_TBL = 'Table({K: "emerging-10", P: 800, F: false}, {K: "emerging-20", P: 1400, F: false}, {K: "emerging-40", P: 2400, F: false}, {K: "emerging-80", P: 4000, F: false}, {K: "mobile kitchen-10", P: 600, F: false}, {K: "mobile kitchen-20", P: 1100, F: false}, {K: "mobile kitchen-40", P: 1600, F: false}, {K: "mobile kitchen-80", P: 2400, F: false}, {K: "legacy-launch", P: 424, F: true}, {K: "legacy: emerging-10a", P: 742, F: true}, {K: "legacy: emerging-10b", P: 515, F: true}, {K: "legacy: emerging-10c", P: 530, F: true}, {K: "legacy: emerging-10d", P: 721, F: true}, {K: "legacy: emerging-10e", P: 550, F: true}, {K: "legacy-mobile kitchen -10a", P: 550, F: true}, {K: "legacy-mobile kitchen -10b", P: 636, F: true}, {K: "legacy-mobile kitchen -10c", P: 530, F: true}, {K: "legacy-mobile kitchen -10d", P: 515, F: true})'
PAY_ROWS = ('With({p: ' + EPERIOD + '}, ForAll(' + ACTIVE_M + ' As m, With({pl: LookUp(AvenuePlans, PlanId = m.PlanId), used: Coalesce(Sum(Filter(AvenueHoursLedger, MemberId = m.MemberId, Period = p), Hours), 0)}, '
            'With({pr: LookUp(' + PRICE_TBL + ', K = Lower(Trim(Coalesce(pl.Title, ""))))}, {Biz: Coalesce(m.BusinessName, m.MemberId), Plan: Coalesce(pl.Title, "no plan"), Day: m.CollectionDay, Priced: !IsBlank(pr), '
            'Monthly: If(IsBlank(pr), 0, pr.P * If(pr.F || m.PayMethod.Value = "Bank", 1, 1.03)), FeeIn: !IsBlank(pr) && pr.F, Used: used, Allow: Coalesce(pl.MonthlyHours, 0), Over: Max(0, used - Coalesce(pl.MonthlyHours, 0)), '
            'Rate: Coalesce(pl.ExtraHourRate, 0), Extra: Max(0, used - Coalesce(pl.MonthlyHours, 0)) * Coalesce(pl.ExtraHourRate, 0) * If(m.PayMethod.Value = "Bank", 1, 1.03)})))) ')
INV = 'Filter(AvenueInvoices, FacilityId = ' + FAC + ')'
OVERDUE = 'Status.Value = "open" && !IsBlank(DueDate) && DueDate < Today()'
MONEY = lambda cents: '"$" & Text(' + cents + ' / 100, "#,##0.00")'
PI_VIS = 'Coalesce(varPayTab, "inv") = "inv"'
PE_VIS = 'Coalesce(varPayTab, "inv") = "exp"'
parts = nav('pay', 'Screen13', 'Payments')
_DY = cy('Screen13') - 60
parts.append(button('payBack', 'Back to More', 20, 60, 140, 34, 'Navigate(Screen12)'))
for i, (tid, cap, vis) in enumerate([('inv', 'Invoices (Stripe, test mode)', PI_VIS), ('exp', 'Expected this month', PE_VIS)]):
    parts.append(button(f'payTab{tid.capitalize()}', cap, 180 + i * 248, 60, 240, 34, f'Set(varPayTab, "{tid}")', Fill=f'If({vis}, {OLIVE}, {SURFACE})', Color=f'If({vis}, {CREAM}, {OLIVE})',
                        BorderColor=OLIVE, BorderThickness=1, HoverFill=f'If({vis}, {OLIVE}, {CREAM})', HoverColor=f'If({vis}, {CREAM}, {OLIVE})', PressedFill=INK2, Size=13))
def _tile(pfx, i, cap, val, sub, y=150):
    x = 24 + i * 332
    parts.append(panel(f'{pfx}T{i}', x, y, 316, 96))
    parts.append(label(f'{pfx}Tc{i}', f'"{cap}"', x + 20, y + 10, 276, 22, Size=12, FontWeight='FontWeight.Bold', Color=SUBTLE))
    parts.append(label(f'{pfx}Tv{i}', val, x + 20, y + 32, 276, 40, Size=28, FontWeight='FontWeight.Bold', Color=INK))
    parts.append(label(f'{pfx}Ts{i}', f'"{sub}"', x + 20, y + 72, 276, 20, Size=11, Color=SUBTLE))
# ----- Tab 1: invoices mirrored from Stripe by the integration host -----
_VIS = PI_VIS
parts.append(label('piNote', '"Invoices on the Flavors Stripe account, copied here by the Avenue server (Stripe TEST MODE: no real money until the client approves, STR-06). Members pay from their own Billing page."', 20, 98, 1310, 40, Size=11, Color=SUBTLE))
_tile('pi', 0, 'Paid this month', MONEY('Sum(Filter(' + INV + ', Status.Value = "paid", DueDate >= ' + MS + ', DueDate < ' + NM + '), AmountPaidCents)'), 'invoices due this month, paid')
_tile('pi', 1, 'Open this month', MONEY('Sum(Filter(' + INV + ', Status.Value = "open", DueDate >= ' + MS + ', DueDate < ' + NM + '), AmountDueCents)'), 'due this month, not paid yet')
_tile('pi', 2, 'Overdue', MONEY('Sum(Filter(' + INV + ', ' + OVERDUE + '), AmountDueCents)'), 'open and past the due date (any month)')
_tile('pi', 3, 'Overdue invoices', 'Text(CountRows(Filter(' + INV + ', ' + OVERDUE + ')))', 'members are refused new bookings')
parts.append(label('piListHead', '"Invoices (newest first)"', 20, 262, 300, 30, FontWeight='FontWeight.Semibold'))
parts.append(ctl('piFilter', 'Classic/DropDown', {'Items': '["All", "Overdue", "Open", "Paid"]', 'Default': '"All"', 'X': 600, 'Y': 258, 'Width': 200, 'Height': 34}))
INV_ROWS = ('SortByColumns(Filter(' + INV + ', piFilter.Selected.Value = "All" || (piFilter.Selected.Value = "Overdue" && ' + OVERDUE + ') || '
            '(piFilter.Selected.Value = "Open" && Status.Value = "open") || (piFilter.Selected.Value = "Paid" && Status.Value = "paid")), "StripeCreated", SortOrder.Descending)')
INV_SHOWN = 'If(ThisItem.Status.Value = "open" && !IsBlank(ThisItem.DueDate) && ThisItem.DueDate < Today(), "Overdue", Switch(ThisItem.Status.Value, "paid", "Paid", "open", "Open", "void", "Void", "uncollectible", "Uncollectible", "Draft"))'
parts.append(gallery('piGal', INV_ROWS, 20, 296, 780, 430, 64, [
    child('piRowTitle', 'Coalesce(LookUp(AvenueMembers, MemberId = ThisItem.MemberId).BusinessName, ThisItem.MemberId) & " · " & Coalesce(ThisItem.Number, "draft")', 8, 4, 560, 28, FontWeight='FontWeight.Semibold'),
    child('piRowMeta', 'ThisItem.Kind.Value & " · due " & If(IsBlank(ThisItem.DueDate), "not set", Text(ThisItem.DueDate, "d mmm yyyy")) & " · " & ' + MONEY('If(ThisItem.Status.Value = "paid", ThisItem.AmountPaidCents, ThisItem.AmountDueCents)'), 8, 34, 560, 24, Size=12, Color=SUBTLE),
    pill('piRowPill', INV_SHOWN, f'Switch({INV_SHOWN}, "Paid", {OKTINT}, "Overdue", {BADTINT}, "Open", {WAITTINT}, {MUTEDTINT})', f'Switch({INV_SHOWN}, "Paid", {OKTEXT}, "Overdue", {BAD}, "Open", {WAIT}, {MUTED})', 640, 18, 120)]))
parts.append(label('piSel', 'If(IsBlank(piGal.Selected), "Select an invoice", "Invoice " & Coalesce(piGal.Selected.Number, "draft"))', 830, 262, 500, 30, FontWeight='FontWeight.Semibold'))
parts.append(label('piDetail', 'If(IsBlank(piGal.Selected), "", "Member: " & piGal.Selected.MemberId & Char(10) & "Amount due: " & ' + MONEY('piGal.Selected.AmountDueCents') + ' & " · paid: " & ' + MONEY('Coalesce(piGal.Selected.AmountPaidCents, 0)') + ' & Char(10) & "Lines: " & Coalesce(piGal.Selected.Lines, "-"))', 830, 296, 500, 110, Size=12))
parts.append(button('piOpen', 'Open in Stripe page', 830, 410, 200, 36, 'Launch(piGal.Selected.HostedUrl)', Visible='(' + PI_VIS + ') && !IsBlank(piGal.Selected) && !IsBlank(piGal.Selected.HostedUrl)'))
# Connect the facility's Stripe account (STR-03): the server mints a fresh Stripe-hosted onboarding link.
HR_ACCT = 'LookUp(AvenueHostRequests, RequestId = varAcctReq)'
parts.append(head('piAcctHead', '"Flavors Stripe account"', 830, 462, 500, 14))
parts.append(button('piAcct', 'Connect / update Stripe account', 830, 490, 260, 36,
    'Set(varAcctReq, "acct-" & Text(GUID())); IfError(Patch(AvenueHostRequests, Defaults(AvenueHostRequests), {Title: "AccountLink", FacilityId: ' + FAC + ', RequestId: varAcctReq, Kind: {Value: "AccountLink"}, Payload: "{}"}); Notify("Asked the server for a Stripe link. Press Check again in a few seconds.", NotificationType.Information), Notify("Could not send the request.", NotificationType.Error))'))
parts.append(button2('piAcctRefresh', 'Check again', 1100, 490, 120, 36, 'Refresh(AvenueHostRequests)', Visible='(' + PI_VIS + ') && !IsBlank(varAcctReq)'))
parts.append(button('piAcctGo', 'Open Stripe', 1230, 490, 100, 36, 'Launch(' + HR_ACCT + '.Link)', Visible='(' + PI_VIS + ') && !IsBlank(varAcctReq) && !IsBlank(' + HR_ACCT + '.Link)'))
parts.append(label('piAcctOut', 'If(IsBlank(varAcctReq), "Opens Stripe\'s own onboarding page; Avenue never sees bank details. The link works once and expires within minutes.", Coalesce(' + HR_ACCT + '.Outcome, "Waiting for the server..."))', 830, 530, 500, 40, Size=11, Color=SUBTLE))
# Private event invoice (sheet "Dining & Event Pricing"): $500 deposit now, package balance 30 days before the event.
HR_EVT = 'LookUp(AvenueHostRequests, RequestId = varEvtReq)'
parts.append(head('piEvtHead', '"Private event invoice"', 830, 580, 500, 14))
parts.append(ctl('piEvtWho', 'Classic/TextInput', {'Default': '""', 'HintText': '"Member e-mail"', 'X': 830, 'Y': 608, 'Width': 250, 'Height': 34}))
parts.append(ctl('piEvtPkg', 'Classic/DropDown', {'Items': '["Simplicity", "Opulence", "Elevation", "Platinum"]', 'Default': '"Simplicity"', 'X': 1090, 'Y': 608, 'Width': 140, 'Height': 34}))
parts.append(ctl('piEvtMem', 'Classic/Toggle', {'Default': 'true', 'TrueText': '"Member"', 'FalseText': '"Non-member"', 'X': 1240, 'Y': 608, 'Width': 90, 'Height': 34}))
parts.append(ctl('piEvtDate', 'Classic/DatePicker', {'DefaultDate': 'DateAdd(Today(), 45, TimeUnit.Days)', 'X': 830, 'Y': 650, 'Width': 250, 'Height': 34}))
parts.append(button('piEvtGo', 'Create event invoice', 1090, 650, 240, 34,
    'If(!IsMatch(Trim(piEvtWho.Text), Match.Email) || IsBlank(piEvtDate.SelectedDate) || piEvtDate.SelectedDate <= Today(), Notify("Enter the member e-mail and a future event date.", NotificationType.Warning), '
    'Set(varEvtReq, "event-" & Text(GUID())); IfError(Patch(AvenueHostRequests, Defaults(AvenueHostRequests), {Title: "EventInvoice", FacilityId: ' + FAC + ', RequestId: varEvtReq, Kind: {Value: "EventInvoice"}, '
    'Payload: "{""memberEmail"":""" & Lower(Trim(piEvtWho.Text)) & """,""packageName"":""" & piEvtPkg.Selected.Value & """,""eventDate"":""" & Text(piEvtDate.SelectedDate, "yyyy-mm-dd") & """,""member"":" & If(piEvtMem.Value, "true", "false") & "}"}); '
    'Notify("Sent to the server. The invoices appear in the list once Stripe confirms.", NotificationType.Information), Notify("Could not send the request.", NotificationType.Error)))'))
parts.append(label('piEvtOut', 'If(IsBlank(varEvtReq), "$500 refundable deposit due now; the package balance is due 30 days before the event (now if sooner). Refunds are done by the owner in Stripe.", Coalesce(' + HR_EVT + '.Outcome, "Waiting for the server... (press Check again)"))', 830, 690, 500, 40, Size=11, Color=SUBTLE))
# ----- Tab 2: expected from plans and hours (unchanged rules, 40 px lower) -----
_VIS = PE_VIS
_DY += 40
parts.append(label('payNote', '"From active members, plan prices and hours this month (facility time). Bank (ACH) pays the list price; card adds 3% (Q-M1 default); legacy plans already include the fee. Late fee $99 after the due date (Q-13: grace to the 5th is open)."', 20, 98, 1310, 44, Size=11, Color='RGBA(96,94,92,1)'))
_tile('pay', 0, 'Expected monthly membership', '"$" & Text(Round(Sum(payGal.AllItems, Monthly), 2), "#,##0.00")', 'plan price, plus 3% for card payers')
_tile('pay', 1, 'Extra hours so far (estimate)', '"$" & Text(Round(Sum(payGal.AllItems, Extra), 2), "#,##0.00")', 'billed with the next payment; none at booking')
_tile('pay', 2, 'Members without a known price', 'Text(CountRows(Filter(payGal.AllItems, !Priced)))', 'plan not in the price table: confirm with Flavors')
_tile('pay', 3, 'Active members', 'Text(CountRows(payGal.AllItems))', 'with a collection day 1-15')
parts.append(label('payListHead', '"By member (this month)"', 20, 262, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(gallery('payGal', PAY_ROWS, 20, 296, 780, 430, 64, [
    child('payRowTitle', 'ThisItem.Biz & " · " & ThisItem.Plan', 8, 4, 520, 28, FontWeight='FontWeight.Semibold'),
    child('payRowMeta', 'If(ThisItem.Priced, "$" & Text(Round(ThisItem.Monthly, 2), "#,##0.00") & If(ThisItem.FeeIn, " (fee included)", ""), "price unknown") & " · due day " & Coalesce(Text(ThisItem.Day), "not set") & " · " & Text(Round(ThisItem.Used, 1)) & " of " & Text(ThisItem.Allow) & " h used"', 8, 34, 640, 24, Size=12, Color='If(ThisItem.Priced, RGBA(96,94,92,1), RGBA(164,38,44,1))'),
    child('payRowExtra', 'If(ThisItem.Over > 0, "+$" & Text(Round(ThisItem.Extra, 2), "#,##0.00") & " extra (" & Text(Round(ThisItem.Over, 1)) & " h)", "")', 560, 4, 200, 28, Size=12, Align='Align.Right', Color='RGBA(164,38,44,1)')]))
parts.append(label('paySel', 'If(IsBlank(payGal.Selected), "Select a member", payGal.Selected.Biz)', 830, 262, 500, 30, FontWeight='FontWeight.Semibold'))
parts.append(label('payDetail', 'If(IsBlank(payGal.Selected), "", "Plan " & payGal.Selected.Plan & Char(10) & "Monthly: " & If(payGal.Selected.Priced, "$" & Text(Round(payGal.Selected.Monthly, 2), "#,##0.00"), "price unknown") & Char(10) & "Extra hours: " & Text(Round(payGal.Selected.Over, 1)) & " h at $" & Text(payGal.Selected.Rate) & "/h = $" & Text(Round(payGal.Selected.Extra, 2), "#,##0.00") & Char(10) & "Collected on day " & Coalesce(Text(payGal.Selected.Day), "not set") & ". A $99 late fee applies after the due date.")', 830, 296, 500, 160, Size=13))
_VIS = None
write('payments.pa.yaml', parts)
_DY = 0


# ---------- Sensors (Screen14): Units | Excursions | Daily log | Settings (owner). docs/ENVIRONMENT_PLAN.md section 6. ----------
# Reads AvenueSensors / AvenueSensorLatest / AvenueSensorHourly / AvenueTempExcursions (written by the host through the bridge). Swift Sensors stays the alarm system (SEN-03).
# State is derived here from the reading and its age, so a stale reading is never shown as current: no reading or older than 2 h = Offline, older than 30 min = Stale, outside MinF..MaxF = Out of range.
OWNER_SN = 'Lower(User().Email) in ' + OWNER_EMAILS   # ponytail: UI gate only, same as the payment override (Q-15)
SN_TAB = lambda t: 'Coalesce(varSenTab, "units") = "' + t + '"'
SN_U, SN_X, SN_L, SN_S = SN_TAB('units'), SN_TAB('exc'), SN_TAB('log'), SN_TAB('set')
# One typed collection, rebuilt by the two timers below. AddColumns cannot read columns it adds in the same call, so three small steps; no ForAll/With-record shapes.
# With({sid: SensorId}, ...) copies the outer column so the LookUp condition does not read the inner table's own SensorId.
SEN_BUILD = ('ClearCollect(colSenA, AddColumns(Filter(AvenueSensors, FacilityId = ' + FAC + ', Active = true), '
             'ReadAtL, With({sid: SensorId}, LookUp(AvenueSensorLatest, SensorId = sid, ReadAt)), '
             'ValF, With({sid: SensorId}, LookUp(AvenueSensorLatest, SensorId = sid, ValueF)))); '
             'ClearCollect(colSenB, AddColumns(colSenA, '
             'AgeMin, If(IsBlank(ReadAtL), 99999, DateDiff(ReadAtL, Now(), TimeUnit.Minutes)), '
             'Idx, Mod(Len(UnitName), 6))); '   # stagger index for the fade-in only (text cannot be compared with < in Power Fx)
             'ClearCollect(colSen, AddColumns(colSenB, '
             'St, If(IsBlank(ValF) || AgeMin > 120, "Offline", If(AgeMin > 30, "Stale", If(ValF < MinF || ValF > MaxF, "Out of range", "Normal"))), '
             'Pos, If(IsBlank(ValF), 0, Max(0, Min(1, (ValF - MinF) / Max(0.1, MaxF - MinF))))))')
SEN_ROWS = 'colSen'
SN_COL = lambda a='1': 'Switch(ThisItem.St, "Normal", RGBA(23,114,58,' + a + '), "Out of range", RGBA(164,38,44,' + a + '), RGBA(91,99,112,' + a + '))'
SN_FILL = 'Switch(ThisItem.St, "Normal", RGBA(220,238,226,1), "Out of range", ' + BADTINT + ', ' + MUTEDTINT + ')'
SN_FADE = 'Min(1, Max(0, (tm_sensors.Value - ThisItem.Idx * 50) / 200))'   # screen timer (420 ms) drives a staggered fade-in per tile
SN_LAST = lambda: ('With({u: LookUp(AvenueSensors, SensorId = varSenUnit)}, Trim(u.Room) & " · safe " & Text(u.MinF) & "°F to " & Text(u.MaxF) & "°F · Swift id " & u.SensorId)')
SN_NAME = lambda sid: 'Coalesce(LookUp(AvenueSensors, SensorId = ' + sid + ').UnitName, ' + sid + ')'

def sen_tile(sfx):
    """Children of one unit tile (name, big temperature, range bar with marker, state pill, age)."""
    mark_x = '8 + Round(ThisItem.Pos * 262, 0)'
    return [
        child('senTName' + sfx, 'ThisItem.UnitName', 8, 6, 240, 26, FontWeight='FontWeight.Semibold', Size=13, Color='RGBA(31,31,31,' + SN_FADE + ')'),
        child('senTTemp' + sfx, 'If(IsBlank(ThisItem.ValF), "–", Text(ThisItem.ValF, "0.0") & "°F")', 232, 2, 140, 36, Size=22, FontWeight='FontWeight.Bold', Align='Align.Right', Color=SN_COL(SN_FADE)),
        child('senTTrack' + sfx, '""', 8, 52, 270, 6, Fill=MUTEDTINT),
        child('senTMark' + sfx, '""', mark_x, 46, 8, 18, Fill=SN_COL(), Visible='!IsBlank(ThisItem.ValF)'),
        pill('senTPill' + sfx, 'ThisItem.St', SN_FILL, SN_COL(), 286, 46, 86, 22),
        child('senTMin' + sfx, 'Text(ThisItem.MinF) & "°"', 8, 64, 80, 14, Size=10, Color=SUBTLE),
        child('senTMax' + sfx, 'Text(ThisItem.MaxF) & "°"', 198, 64, 80, 14, Size=10, Color=SUBTLE, Align='Align.Right'),
        child('senTAge' + sfx, 'If(ThisItem.AgeMin >= 99999, "No reading yet", "Updated " & If(ThisItem.AgeMin < 1, "just now", Text(ThisItem.AgeMin) & " min ago"))', 8, 78, 364, 14, Size=10, Color=SUBTLE)]

parts = nav('sen', 'Screen12', 'Sensors')
_DY = cy('Screen14') - 60
parts.append(button('senBack', 'Back to More', 20, 60, 140, 34, 'Navigate(Screen12)'))
for i, (tid, cap, vis) in enumerate([('units', 'Units', SN_U), ('exc', 'Excursions', SN_X), ('log', 'Daily log', SN_L), ('set', 'Settings (owner)', SN_S)]):
    extra = {'Visible': OWNER_SN} if tid == 'set' else {}
    parts.append(button(f'senTab{tid.capitalize()}', cap, 180 + i * 158, 60, 150, 34, f'Set(varSenTab, "{tid}")' + ('; ' + SEN_BUILD if tid == 'units' else ''), Fill=f'If({vis}, {OLIVE}, {SURFACE})', Color=f'If({vis}, {CREAM}, {OLIVE})',
                        BorderColor=OLIVE, BorderThickness=1, HoverFill=f'If({vis}, {OLIVE}, {CREAM})', HoverColor=f'If({vis}, {CREAM}, {OLIVE})', PressedFill=INK2, Size=13, **extra))
parts.append(ctl('senInit', 'Timer', {'Duration': 600, 'AutoStart': 'true', 'Repeat': 'false', 'Visible': 'false', 'OnTimerEnd': SEN_BUILD, 'X': 0, 'Y': 0, 'Width': 10, 'Height': 10}))
parts.append(ctl('senRefresh', 'Timer', {'Duration': 60000, 'AutoStart': 'true', 'Repeat': 'true', 'Visible': 'false', 'OnTimerEnd': 'Refresh(AvenueSensorLatest); ' + SEN_BUILD, 'X': 0, 'Y': 0, 'Width': 10, 'Height': 10}))
parts.append(label('senNote', '"Readings come from Swift Sensors through the Avenue server about every 10 minutes. Swift Sensors stays the alarm system: this screen shows status and keeps the record. Open questions: Q-12 and Q-E1 (two units share one name; confirm the ninth sensor)."', 20, 98, 1310, 36, Size=11, Color=SUBTLE))
_tile('sn', 0, 'Units reporting', 'Text(CountRows(Filter(colSen, St = "Normal" || St = "Out of range"))) & " of " & Text(CountRows(colSen))', 'fresh reading within 30 minutes', y=140)
_tile('sn', 1, 'Out of range now', 'Text(CountRows(Filter(colSen, St = "Out of range")))', 'outside the safe range of the unit', y=140)
_tile('sn', 2, 'Stale or offline', 'Text(CountRows(Filter(colSen, St = "Stale" || St = "Offline")))', 'no fresh reading: 30 minutes or 2 hours', y=140)
_tile('sn', 3, 'Open excursions', 'Text(CountRows(Filter(AvenueTempExcursions, State.Value = "Open")))', 'staff acknowledge them on the Excursions tab', y=140)

# ----- Tab 1: unit tiles by room, detail for the selected unit -----
_VIS = SN_U
parts.append(head('senRoomA', '"Sink Room"', 20, 248, 380, 14))
parts.append(head('senRoomB', '"Storage Room"', 410, 248, 380, 14))
parts.append(gallery('senGalA', 'SortByColumns(Filter(colSen, Trim(Room) = "Sink Room"), "UnitName", SortOrder.Ascending)', 20, 280, 380, 450, 96, sen_tile('A'), OnSelect='Set(varSenUnit, ThisItem.SensorId)'))
parts.append(gallery('senGalB', 'SortByColumns(Filter(colSen, Trim(Room) = "Storage Room"), "UnitName", SortOrder.Ascending)', 410, 280, 380, 450, 96, sen_tile('B'), OnSelect='Set(varSenUnit, ThisItem.SensorId)'))
parts.append(label('senEmpty', '"No sensors loaded yet. They are added from the client sheet by the sensor load script (Q-E1: confirm the two units that share one name)."', 20, 290, 770, 40, Size=12, Color=SUBTLE,
                   Visible='(' + SN_U + ') && CountRows(AvenueSensors) = 0'))
parts.append(head('senSel', 'If(IsBlank(varSenUnit), "Select a unit", ' + SN_NAME('varSenUnit') + ')', 810, 248, 520, 14))
parts.append(label('senDetail', 'If(IsBlank(varSenUnit), "Tap a tile to see the last 24 hours and its open excursions.", ' + SN_LAST() + ')', 810, 278, 520, 40, Size=11, Color=SUBTLE))
for i, (cap, x) in enumerate([('Hour', 818), ('Min', 980), ('Avg', 1060), ('Max', 1140), ('Out of range', 1220)]):
    parts.append(label(f'senHrCap{i}', f'"{cap}"', x, 324, 100 if i == 4 else 70, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE, Visible='!IsBlank(varSenUnit) && (' + SN_U + ')'))
parts.append(gallery('senHrGal', 'SortByColumns(Filter(AvenueSensorHourly, SensorId = varSenUnit, HourUtc >= DateAdd(Now(), -24, TimeUnit.Hours)), "HourUtc", SortOrder.Descending)', 810, 346, 520, 196, 32, [
    child('senHrHour', f_local('ThisItem.HourUtc', 'ddd h AM/PM'), 8, 4, 160, 24),
    child('senHrMin', 'Text(ThisItem.MinF, "0.0")', 170, 4, 70, 24),
    child('senHrAvg', 'Text(ThisItem.AvgF, "0.0")', 250, 4, 70, 24),
    child('senHrMax', 'Text(ThisItem.MaxF, "0.0")', 330, 4, 70, 24),
    child('senHrOor', 'Text(Coalesce(ThisItem.OutOfRangeCount, 0))', 410, 4, 100, 24)]))
parts.append(head('senUxHead', '"Open excursions for this unit"', 810, 552, 520, 13, Visible='!IsBlank(varSenUnit) && (' + SN_U + ')'))
parts.append(gallery('senUxGal', 'Filter(AvenueTempExcursions, SensorId = varSenUnit, State.Value = "Open")', 810, 582, 520, 148, 48, [
    child('senUxTitle', '"Started " & ' + f_local('ThisItem.StartedAt', 'ddd h:mm AM/PM') + ' & " · peak " & Text(ThisItem.PeakF, "0.0") & "°F"', 8, 4, 500, 24, FontWeight='FontWeight.Semibold'),
    child('senUxMeta', 'If(IsBlank(ThisItem.EndedAt), "still out of range", Text(ThisItem.Minutes) & " min")', 8, 26, 500, 18, Size=11, Color=SUBTLE)]))

# ----- Tab 2: excursions; staff acknowledge with the corrective action (inspection record) -----
_VIS = SN_X
parts.append(head('senExHead', '"Temperature excursions (open first, then newest)"', 20, 248, 780, 14))
parts.append(gallery('senExGal', 'SortByColumns(AddColumns(AvenueTempExcursions, Rank, If(State.Value = "Open", 0, 1)), "Rank", SortOrder.Ascending, "StartedAt", SortOrder.Descending)', 20, 280, 780, 450, 64, [
    child('senExTitle', SN_NAME('ThisItem.SensorId') + ' & " · peak " & Text(ThisItem.PeakF, "0.0") & "°F"', 8, 4, 560, 28, FontWeight='FontWeight.Semibold'),
    child('senExMeta', f_local('ThisItem.StartedAt', 'ddd d mmm, h:mm AM/PM') + ' & " · " & If(IsBlank(ThisItem.EndedAt), "still out of range", Text(ThisItem.Minutes) & " min")', 8, 34, 600, 22, Size=11, Color=SUBTLE),
    pill('senExPill', 'ThisItem.State.Value', 'Switch(ThisItem.State.Value, "Open", ' + BADTINT + ', "Acknowledged", RGBA(220,238,226,1), ' + MUTEDTINT + ')',
         'Switch(ThisItem.State.Value, "Open", ' + BAD + ', "Acknowledged", RGBA(23,114,58,1), ' + MUTED + ')', 640, 18, 120)]))
parts.append(head('senExSel', 'If(IsBlank(senExGal.Selected), "Select an excursion", ' + SN_NAME('senExGal.Selected.SensorId') + ')', 830, 248, 500, 14))
parts.append(label('senExDetail', 'If(IsBlank(senExGal.Selected), "Choose one from the list to record what was done.", "Started " & ' + f_local('senExGal.Selected.StartedAt', 'ddd d mmm, h:mm AM/PM') + ' & " · peak " & Text(senExGal.Selected.PeakF, "0.0") & "°F" & Char(10) & '
                   'If(senExGal.Selected.State.Value = "Acknowledged", "Acknowledged by " & senExGal.Selected.AcknowledgedBy & Char(10) & "Action: " & senExGal.Selected.CorrectiveAction, "Not acknowledged yet"))', 830, 278, 500, 90, Size=12))
parts.append(ctl('senAckNote', 'Classic/TextInput', {'Default': '""', 'HintText': '"Corrective action taken (required), e.g. door left open, product checked at 39 F"', 'Mode': 'TextMode.MultiLine', 'X': 830, 'Y': 380, 'Width': 500, 'Height': 90}))
parts.append(button('senAck', 'Acknowledge', 830, 482, 200, 36,
    'IfError(Patch(AvenueTempExcursions, LookUp(AvenueTempExcursions, ExcursionId = senExGal.Selected.ExcursionId), {State: {Value: "Acknowledged"}, AcknowledgedBy: User().Email, AcknowledgedAt: Now(), CorrectiveAction: Trim(senAckNote.Text)}); Reset(senAckNote); '
    'Notify("Acknowledged and recorded.", NotificationType.Success), Notify("Could not save the acknowledgement.", NotificationType.Error))',
    DisplayMode='If(!IsBlank(senExGal.Selected) && senExGal.Selected.State.Value <> "Acknowledged" && !IsBlank(Trim(senAckNote.Text)), DisplayMode.Edit, DisplayMode.Disabled)'))
parts.append(hint('senAckHelp', '"The note is kept with the record for the health inspector. It cannot be left empty."', 830, 524, 500, 22))

# ----- Tab 3: daily log (hourly min / max per unit for one facility-time day) -----
_VIS = SN_L
DAY_A = f_day_start('senLogDate.SelectedDate')
DAY_B = f_day_start('DateAdd(Coalesce(senLogDate.SelectedDate, Today()), 1, TimeUnit.Days)')
parts.append(head('senLogHead', '"Daily log (facility time)"', 20, 248, 400, 14))
parts.append(ctl('senLogDate', 'Classic/DatePicker', {'DefaultDate': 'Today()', 'X': 20, 'Y': 284, 'Width': 220, 'Height': 34}))
parts.append(hint('senLogHelp', '"Hourly minimum, average and maximum per unit. To give an inspector a file, open the list AvenueSensorHourly in SharePoint, use Export to Excel and filter this date. A one-click export button is not in this app yet."', 260, 282, 1070, 40))
for i, (cap, x, w) in enumerate([('Unit', 28, 300), ('Hour', 340, 120), ('Min', 480, 80), ('Avg', 570, 80), ('Max', 660, 80), ('Out of range', 750, 120)]):
    parts.append(label(f'senLgCap{i}', f'"{cap}"', x, 330, w, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(gallery('senLogGal', 'With({a: ' + DAY_A + ', b: ' + DAY_B + '}, SortByColumns(Filter(AvenueSensorHourly, HourUtc >= a, HourUtc < b), "SensorId", SortOrder.Ascending, "HourUtc", SortOrder.Ascending))', 20, 354, 880, 376, 32, [
    child('senLgUnit', SN_NAME('ThisItem.SensorId'), 8, 4, 300, 24, FontWeight='FontWeight.Semibold'),
    child('senLgHour', f_local('ThisItem.HourUtc', 'h AM'), 320, 4, 120, 24),
    child('senLgMin', 'Text(ThisItem.MinF, "0.0")', 460, 4, 80, 24),
    child('senLgAvg', 'Text(ThisItem.AvgF, "0.0")', 550, 4, 80, 24),
    child('senLgMax', 'Text(ThisItem.MaxF, "0.0")', 640, 4, 80, 24),
    child('senLgOor', 'Text(Coalesce(ThisItem.OutOfRangeCount, 0))', 730, 4, 120, 24)]))

# ----- Tab 4: settings (owner): unit name, safe range, active -----
_VIS = '(' + SN_S + ') && ' + OWNER_SN
SET_OK = '!IsBlank(senSetGal.Selected) && !IsBlank(Trim(senSetName.Text)) && IsNumeric(senSetMin.Text) && IsNumeric(senSetMax.Text) && Value(senSetMin.Text) < Value(senSetMax.Text)'
parts.append(head('senSetHead', '"Units (owner)"', 20, 248, 500, 14))
parts.append(gallery('senSetGal', 'SortByColumns(Filter(AvenueSensors, FacilityId = ' + FAC + '), "UnitName", SortOrder.Ascending)', 20, 280, 520, 450, 56, [
    child('senSetRowName', 'ThisItem.UnitName & If(ThisItem.Active, "", " (inactive)")', 8, 4, 500, 26, FontWeight='FontWeight.Semibold'),
    child('senSetRowMeta', 'Trim(ThisItem.Room) & " · safe " & Text(ThisItem.MinF) & "°F to " & Text(ThisItem.MaxF) & "°F · " & ThisItem.SensorId', 8, 30, 500, 22, Size=11, Color=SUBTLE)]))
parts.append(head('senSetSel', 'If(IsBlank(senSetGal.Selected), "Select a unit to edit", "Edit " & senSetGal.Selected.UnitName)', 570, 248, 760, 14))
parts.append(label('senSetNameCap', '"Unit name"', 570, 284, 300, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(ctl('senSetName', 'Classic/TextInput', {'Default': 'senSetGal.Selected.UnitName', 'X': 570, 'Y': 306, 'Width': 360, 'Height': 34}))
parts.append(label('senSetMinCap', '"Safe minimum (°F)"', 570, 352, 170, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(label('senSetMaxCap', '"Safe maximum (°F)"', 750, 352, 170, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(ctl('senSetMin', 'Classic/TextInput', {'Default': 'Text(senSetGal.Selected.MinF)', 'X': 570, 'Y': 374, 'Width': 170, 'Height': 34}))
parts.append(ctl('senSetMax', 'Classic/TextInput', {'Default': 'Text(senSetGal.Selected.MaxF)', 'X': 750, 'Y': 374, 'Width': 180, 'Height': 34}))
parts.append(ctl('senSetActive', 'Classic/Toggle', {'Default': 'senSetGal.Selected.Active', 'TrueText': '"Active"', 'FalseText': '"Inactive"', 'X': 570, 'Y': 424, 'Width': 160, 'Height': 34}))
parts.append(button('senSetSave', 'Save unit', 570, 474, 200, 36,
    'IfError(Patch(AvenueSensors, LookUp(AvenueSensors, SensorId = senSetGal.Selected.SensorId), {UnitName: Trim(senSetName.Text), MinF: Value(senSetMin.Text), MaxF: Value(senSetMax.Text), Active: senSetActive.Value}); '
    'Notify("Saved. The server reads the new range within the hour.", NotificationType.Success), Notify("Could not save the unit.", NotificationType.Error))',
    DisplayMode='If(' + SET_OK + ', DisplayMode.Edit, DisplayMode.Disabled)'))
parts.append(hint('senSetHelp', 'If(' + SET_OK + ', "", "Enter a name and numbers where the minimum is below the maximum.")', 570, 518, 760, 22, Color=BAD))
parts.append(hint('senSetNote', '"The range is the safe range from the client sheet (fridges 36 to 40, freezers minus 8 to 0). Excursion rule: two readings in a row outside it."', 570, 546, 760, 40))
_VIS = None
write('sensors.pa.yaml', parts)
_DY = 0


# ---------- Shared bits for the case-queue screens (Support, Events, Storage): status chips and a read-only 'who / what' header ----------
def case_chips(pfx, var, lst, items, y=104):
    """Status filter chips with live counts. items = [(key, caption)]; key 'All' shows every row."""
    for i, (key, cap) in enumerate(items):
        on_ = f'Coalesce({var}, "All") = "{key}"'
        n = 'CountRows(Filter(' + lst + ', FacilityId = ' + FAC + '))' if key == 'All' else 'CountRows(Filter(' + lst + ', FacilityId = ' + FAC + ', Status.Value = "' + key + '"))'
        parts.append(button(f'{pfx}Chip{key}', '', 20 + i * 136, y, 128, 30, f'Set({var}, "{key}")', Text='"' + cap + ' (" & Text(' + n + ') & ")"',
                            Fill=f'If({on_}, {OLIVE}, {SURFACE})', Color=f'If({on_}, {CREAM}, {OLIVE})', BorderColor=OLIVE, BorderThickness=1,
                            HoverFill=f'If({on_}, {OLIVE}, {CREAM})', HoverColor=f'If({on_}, {CREAM}, {OLIVE})', PressedFill=INK2, Size=12,
                            RadiusTopLeft=15, RadiusTopRight=15, RadiusBottomLeft=15, RadiusBottomRight=15))
def case_rows(lst, var, rank, then):
    """Filtered, ranked rows for a case gallery. Rank is a bare AddColumns name (Studio rule); `then` = extra SortByColumns arguments."""
    return ('With({st: Coalesce(' + var + ', "All")}, SortByColumns(AddColumns(If(st = "All", Filter(' + lst + ', FacilityId = ' + FAC + '), Filter(' + lst + ', FacilityId = ' + FAC + ', Status.Value = st)), Rank, ' + rank + '), "Rank", SortOrder.Ascending, ' + then + '))')
def status_pill(name, st, wait, ok, x=496, y=20, w=128):
    """Status pill: `wait` = statuses shown amber, `ok` = statuses shown teal, anything else neutral grey."""
    fill = 'Switch(' + st + ', ' + ', '.join(f'"{s}", {WAITTINT}' for s in wait) + ', ' + ', '.join(f'"{s}", {OKTINT}' for s in ok) + ', ' + MUTEDTINT + ')'
    col = 'Switch(' + st + ', ' + ', '.join(f'"{s}", {WAIT}' for s in wait) + ', ' + ', '.join(f'"{s}", {OKTEXT}' for s in ok) + ', ' + MUTED + ')'
    return pill(name, st, fill, col, x, y, w)


# ---------- Support (Screen15): conversations members start from "Messages with Flavors" ----------
# Reads AvenueSupportCases (private copy made by a flow from the member's own AvenueSupportMessages item). A reply here is written to the case; a second flow echoes it to the member (specified, not built).
parts = nav('sup', 'Screen12', 'Support')
_DY = cy('Screen15') - 60
SUP_SEL = 'supGal.Selected'
SUP_REAL = 'LookUp(AvenueSupportCases, CaseId = ' + SUP_SEL + '.CaseId)'
SUP_L = 'AvenueSupportCases, FacilityId = ' + FAC
SUP_WHO = 'User().Email & ", " & Text(Now(), "d mmm yyyy h:mm AM/PM")'
# Archive instead of delete (developer decision 23 Nov; Q-R5 open). "All" hides archived cases; the Archived chip shows them.
# Owner hard delete of a case and its member thread is a flow, specified in flows/expressions.md (not built, no button here).
parts.append(button('supBack', 'Back to More', 20, 60, 140, 34, 'Navigate(Screen12)'))
parts.append(head('supHead', '"Messages from members"', 180, 60, 400, 20))
parts.append(ctl('supCatFilter', 'Classic/DropDown', {'Items': 'ForAll(SortByColumns(Filter(AvenueSupportCategories, FacilityId = ' + FAC + '), "SortOrder", SortOrder.Ascending), {Value: Title})', 'Default': '""', 'AllowEmptySelection': 'true',
                                                       'X': 880, 'Y': 60, 'Width': 290, 'Height': 34}))
parts.append(hint('supCatHint', '"Topic filter (empty = all topics)"', 660, 64, 214, 28, Visible='IsBlank(supCatFilter.Selected.Value)'))
parts.append(button2('supRefresh', 'Refresh', 1190, 60, 140, 34, 'Refresh(AvenueSupportCases); Refresh(AvenueSupportMessages); Refresh(AvenueSupportFiles)'))
for i, (key, cap) in enumerate([('All', 'All'), ('Open', 'Open'), ('Answered', 'Answered'), ('Closed', 'Closed'), ('Archived', 'Archived')]):
    on_ = f'Coalesce(varSupStage, "All") = "{key}"'
    n = 'CountRows(Filter(' + SUP_L + ', Status.Value <> "Archived"))' if key == 'All' else 'CountRows(Filter(' + SUP_L + ', Status.Value = "' + key + '"))'
    parts.append(button(f'supChip{key}', '', 20 + i * 136, 104, 128, 30, f'Set(varSupStage, "{key}")', Text='"' + cap + ' (" & Text(' + n + ') & ")"',
                        Fill=f'If({on_}, {OLIVE}, {SURFACE})', Color=f'If({on_}, {CREAM}, {OLIVE})', BorderColor=OLIVE, BorderThickness=1,
                        HoverFill=f'If({on_}, {OLIVE}, {CREAM})', HoverColor=f'If({on_}, {CREAM}, {OLIVE})', PressedFill=INK2, Size=12,
                        RadiusTopLeft=15, RadiusTopRight=15, RadiusBottomLeft=15, RadiusBottomRight=15))
# No OR inside Filter (Studio delegation rule): one Filter per status/topic combination.
SUP_ROWS = ('With({st: Coalesce(varSupStage, "All"), ct: Coalesce(supCatFilter.Selected.Value, "")}, SortByColumns(AddColumns('
            'If(st = "All", If(ct = "", Filter(' + SUP_L + ', Status.Value <> "Archived"), Filter(' + SUP_L + ', Status.Value <> "Archived", Category.Value = ct)), '
            'If(ct = "", Filter(' + SUP_L + ', Status.Value = st), Filter(' + SUP_L + ', Status.Value = st, Category.Value = ct))), '
            'Rank, Switch(Status.Value, "Open", 0, "Answered", 1, "Closed", 2, 3)), "Rank", SortOrder.Ascending, "CreatedAt", SortOrder.Descending))')
parts.append(gallery('supGal', SUP_ROWS, 20, 150, 640, 580, 66, [
    child('supItemTitle', 'Coalesce(ThisItem.Subject, "(no subject)")', 8, 4, 480, 28, FontWeight='FontWeight.Semibold'),
    child('supItemMeta', 'Coalesce(ThisItem.Category.Value, "-") & " · " & ThisItem.MemberId', 8, 34, 480, 22, Size=11, Color=SUBTLE),
    status_pill('supItemPill', 'ThisItem.Status.Value', ['Open'], ['Answered'])]))
parts.append(label('supEmpty', '"No conversations in this view yet. Members start them from Messages with Flavors in the portal."', 28, 170, 620, 40, Size=12, Color=SUBTLE,
                   Visible='CountRows(supGal.AllItems) = 0'))
parts.append(label('supSelHead', 'If(IsBlank(' + SUP_SEL + '), "Select a conversation", ' + SUP_SEL + '.Subject)', 690, 150, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(label('supSelInfo', 'If(IsBlank(' + SUP_SEL + '), "", "From " & ' + SUP_SEL + '.MemberId & " · " & Coalesce(' + SUP_SEL + '.Category.Value, "-") & " · " & ' + SUP_SEL + '.Status.Value & Char(10) & "Opened " & ' +
                   f_local(SUP_SEL + '.CreatedAt', 'ddd d mmm, h:mm AM/PM') + ' & If(IsBlank(' + SUP_SEL + '.RepliedAt), "", " · last reply by " & ' + SUP_SEL + '.RepliedBy & " " & ' + f_local(SUP_SEL + '.RepliedAt', 'd mmm, h:mm AM/PM') + ') & '
                   'If(IsBlank(' + SUP_SEL + '.ArchivedAt), "", Char(10) & "Archived by " & ' + SUP_SEL + '.ArchivedBy & " " & ' + f_local(SUP_SEL + '.ArchivedAt', 'd mmm yyyy') + '))', 690, 184, 640, 58, Size=12))
# Full thread: the member's own AvenueSupportMessages items with this ThreadId. UNKNOWN whether staff accounts can read members' own-items
# (item-level read) entries; if they cannot, the gallery is empty and the case's LastMessage is shown instead.
SUP_THREAD = 'If(IsBlank(' + SUP_SEL + '), Blank(), SortByColumns(Filter(AvenueSupportMessages, ThreadId = ' + SUP_SEL + '.ThreadId), "Created", SortOrder.Ascending))'
parts.append(label('supMsgCap', 'If(CountRows(supThread.AllItems) > 0, "Conversation (" & CountRows(supThread.AllItems) & " messages from the member)", "Member\'s last message (thread not readable here)")', 690, 246, 640, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(gallery('supThread', SUP_THREAD, 690, 268, 640, 190, 70, [
    child('supThWho', 'Coalesce(ThisItem.Author.DisplayName, "Member") & " · " & Text(ThisItem.Created, "ddd d mmm, h:mm AM/PM")', 8, 2, 600, 20, Size=10, Color=SUBTLE),
    child('supThBody', 'ThisItem.Body', 8, 22, 600, 44, Size=11)], Visible='CountRows(supThread.AllItems) > 0'))
parts.append(label('supMsg', 'If(IsBlank(' + SUP_SEL + '), "", Coalesce(' + SUP_SEL + '.LastMessage, ""))', 690, 268, 640, 110, Size=12, Visible='CountRows(supThread.AllItems) = 0'))
parts.append(label('supFilesCap', '"Attachments (private copies; click to open)"', 690, 464, 640, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(gallery('supFiles', 'If(IsBlank(' + SUP_SEL + '), Blank(), Filter(AvenueSupportFiles, CaseId = ' + SUP_SEL + '.CaseId))', 690, 486, 640, 64, 30, [
    child('supFileName', "ThisItem.'File name with extension'", 8, 2, 600, 26, Size=11, Color=OLIVE, OnSelect="Launch(ThisItem.'Link to item')")]))
parts.append(hint('supFilesNone', '"No attachments."', 698, 490, 600, 24, Visible='CountRows(supFiles.AllItems) = 0'))
parts.append(label('supPrevCap', '"Your last reply"', 690, 556, 300, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE, Visible='!IsBlank(' + SUP_SEL + ') && !IsBlank(' + SUP_SEL + '.StaffReply)'))
parts.append(label('supPrev', 'If(IsBlank(' + SUP_SEL + '), "", Coalesce(' + SUP_SEL + '.StaffReply, ""))', 690, 576, 640, 40, Size=11, Color=SUBTLE, Visible='!IsBlank(' + SUP_SEL + ') && !IsBlank(' + SUP_SEL + '.StaffReply)'))
parts.append(ctl('supReplyIn', 'Classic/TextInput', {'Default': '""', 'HintText': '"Reply to the member (required)"', 'Mode': 'TextMode.MultiLine', 'X': 690, 'Y': 622, 'Width': 640, 'Height': 80}))
SUP_LIVE = '!IsBlank(' + SUP_SEL + ') && ' + SUP_SEL + '.Status.Value <> "Closed" && ' + SUP_SEL + '.Status.Value <> "Archived"'
parts.append(button('supSend', 'Send reply', 690, 712, 180, 38,
    'IfError(Patch(AvenueSupportCases, ' + SUP_REAL + ', {StaffReply: Trim(supReplyIn.Text), RepliedBy: User().Email, RepliedAt: Now(), Status: {Value: "Answered"}}); Reset(supReplyIn); '
    'Notify("Reply saved. The member sees it in the portal.", NotificationType.Success), Notify("Could not save the reply.", NotificationType.Error))',
    DisplayMode='If(' + SUP_LIVE + ' && !IsBlank(Trim(supReplyIn.Text)), DisplayMode.Edit, DisplayMode.Disabled)'))
parts.append(button2('supClose', 'Close', 880, 712, 120, 38,
    'IfError(Patch(AvenueSupportCases, ' + SUP_REAL + ', {Status: {Value: "Closed"}}); Notify("Closed.", NotificationType.Success), Notify("Could not close it.", NotificationType.Error))',
    DisplayMode='If(' + SUP_LIVE + ', DisplayMode.Edit, DisplayMode.Disabled)'))
parts.append(button2('supReopen', 'Reopen', 1010, 712, 120, 38,
    'IfError(Patch(AvenueSupportCases, ' + SUP_REAL + ', {Status: {Value: "Open"}, ArchivedBy: "", ArchivedAt: Blank()}); Notify("Reopened.", NotificationType.Success), Notify("Could not reopen it.", NotificationType.Error))',
    DisplayMode='If(!IsBlank(' + SUP_SEL + ') && (' + SUP_SEL + '.Status.Value = "Closed" || ' + SUP_SEL + '.Status.Value = "Archived"), DisplayMode.Edit, DisplayMode.Disabled)'))
parts.append(button2('supArchive', 'Archive', 1140, 712, 190, 38,
    'IfError(Patch(AvenueSupportCases, ' + SUP_REAL + ', {Status: {Value: "Archived"}, ArchivedBy: User().Email, ArchivedAt: Now()}); Notify("Archived: hidden from All, kept for the record. The member\'s own messages are not changed.", NotificationType.Success), Notify("Could not archive it.", NotificationType.Error))',
    DisplayMode='If(!IsBlank(' + SUP_SEL + ') && ' + SUP_SEL + '.Status.Value <> "Archived", DisplayMode.Edit, DisplayMode.Disabled)'))
parts.append(ctl('supCatEdit', 'Classic/DropDown', {'Items': 'ForAll(SortByColumns(Filter(AvenueSupportCategories, FacilityId = ' + FAC + ', Active = true), "SortOrder", SortOrder.Ascending), {Value: Title})',
                                                     'Default': 'Coalesce(' + SUP_SEL + '.Category.Value, "")', 'AllowEmptySelection': 'true', 'X': 690, 'Y': 766, 'Width': 240, 'Height': 36}))
parts.append(ctl('supStEdit', 'Classic/DropDown', {'Items': '["Open", "Answered", "Closed", "Archived"]', 'Default': 'Coalesce(' + SUP_SEL + '.Status.Value, "Open")', 'X': 940, 'Y': 766, 'Width': 170, 'Height': 36}))
parts.append(button2('supSaveMeta', 'Save topic and status', 1120, 766, 210, 36,
    'IfError(Patch(AvenueSupportCases, ' + SUP_REAL + ', {Category: {Value: Coalesce(supCatEdit.Selected.Value, ' + SUP_SEL + '.Category.Value)}, Status: {Value: supStEdit.Selected.Value}, '
    'ArchivedBy: If(supStEdit.Selected.Value = "Archived", User().Email, ""), ArchivedAt: If(supStEdit.Selected.Value = "Archived", Now(), Blank())}); Notify("Saved (" & ' + SUP_WHO + ' & ").", NotificationType.Success), Notify("Could not save.", NotificationType.Error))',
    DisplayMode='If(IsBlank(' + SUP_SEL + '), DisplayMode.Disabled, DisplayMode.Edit)'))
parts.append(hint('supHelp', '"Replies are shown to the member in the portal. Nobody is promised a reply time and no contact details are published (Q-13 and Q-P1 are open). Archive hides a case from All; nothing is deleted from this screen (Q-R5)."', 690, 810, 640, 44))
write('support.pa.yaml', parts)
_DY = 0


# ---------- Events (Screen21): private-event and dining requests from members (BKG-16/17) ----------
# Reads AvenueEventCases. Approve records the quote and asks the server for the deposit and balance invoices (host request kind EventInvoice, staff only); the server uses the sheet prices.
PKG_TBL = 'Table({K: "Simplicity", H: 4, P: 950}, {K: "Opulence", H: 6, P: 1200}, {K: "Elevation", H: 8, P: 1400}, {K: "Platinum", H: 12, P: 1850})'
EV_SEL = 'evGal.Selected'
EV_REAL = 'LookUp(AvenueEventCases, CaseId = ' + EV_SEL + '.CaseId)'
EV_HR = 'LookUp(AvenueHostRequests, RequestId = varEvReq)'
EV_DAY = lambda r: f_local(r + '.EventDate', 'ddd d mmm yyyy')
parts = nav('ev', 'Screen12', 'Events')
_DY = cy('Screen21') - 60
parts.append(button('evBack', 'Back to More', 20, 60, 140, 34, 'Navigate(Screen12)'))
parts.append(head('evHead', '"Event requests"', 180, 60, 400, 20))
parts.append(button2('evRefresh', 'Refresh', 1190, 60, 140, 34, 'Refresh(AvenueEventCases)'))
case_chips('ev', 'varEvStage', 'AvenueEventCases', [('All', 'All'), ('Requested', 'Requested'), ('Approved', 'Approved'), ('Invoiced', 'Invoiced'), ('Declined', 'Declined')])
parts.append(gallery('evGal', case_rows('AvenueEventCases', 'varEvStage', 'Switch(Status.Value, "Requested", 0, "Approved", 1, "Invoiced", 2, 3)', '"EventDate", SortOrder.Ascending'), 20, 150, 640, 580, 66, [
    child('evItemTitle', 'ThisItem.Package.Value & " · " & Coalesce(Text(ThisItem.Guests), "?") & " guests"', 8, 4, 480, 28, FontWeight='FontWeight.Semibold'),
    child('evItemMeta', EV_DAY('ThisItem') + ' & " · " & ThisItem.MemberId', 8, 34, 480, 22, Size=11, Color=SUBTLE),
    status_pill('evItemPill', 'ThisItem.Status.Value', ['Requested'], ['Approved', 'Invoiced'])]))
parts.append(label('evEmpty', '"No event requests yet. Members send them from Events in the portal."', 28, 170, 620, 40, Size=12, Color=SUBTLE, Visible='CountRows(AvenueEventCases) = 0'))
parts.append(label('evSelHead', 'If(IsBlank(' + EV_SEL + '), "Select a request", ' + EV_SEL + '.Package.Value & " · " & ' + EV_SEL + '.MemberId)', 690, 150, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(label('evSelInfo', 'If(IsBlank(' + EV_SEL + '), "", "Date: " & ' + EV_DAY(EV_SEL) + ' & " · " & Coalesce(Text(' + EV_SEL + '.Guests), "?") & " guests · " & ' + EV_SEL + '.Status.Value & Char(10) & '
                   'If(IsBlank(' + EV_SEL + '.Notes), "No notes from the member.", "Notes: " & ' + EV_SEL + '.Notes) & If(IsBlank(' + EV_SEL + '.DecidedBy), "", Char(10) & "Decided by " & ' + EV_SEL + '.DecidedBy & " · " & ' + f_local(EV_SEL + '.DecidedAt', 'd mmm yyyy') + '))', 690, 184, 640, 100, Size=12))
parts.append(label('evRule', '"Dining room only. A $500 refundable deposit is due now; the package balance is due 30 days before the event, or at once when booked less than 30 days ahead. The deposit is lost if cancelled under 30 days (Q8 and Q9 are open: no refund is built, refunds are done by the owner in Stripe)."', 690, 290, 640, 60, Size=11, Color=SUBTLE))
parts.append(label('evQuoteCap', '"Quote in dollars (recorded with the request; the invoice uses the sheet price on the server)"', 690, 358, 640, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(ctl('evQuote', 'Classic/TextInput', {'Default': 'If(IsBlank(' + EV_SEL + '), "", Text(If(Coalesce(' + EV_SEL + '.QuoteCents, 0) > 0, ' + EV_SEL + '.QuoteCents / 100, Coalesce(LookUp(' + PKG_TBL + ', K = ' + EV_SEL + '.Package.Value).P, 0)), "0.00"))',
                                           'X': 690, 'Y': 380, 'Width': 200, 'Height': 34}))
parts.append(ctl('evReason', 'Classic/TextInput', {'Default': '""', 'HintText': '"Reason (needed to decline)"', 'Mode': 'TextMode.MultiLine', 'X': 690, 'Y': 424, 'Width': 640, 'Height': 60}))
EV_OPEN = '!IsBlank(' + EV_SEL + ') && ' + EV_SEL + '.Status.Value = "Requested"'
EV_OK = EV_OPEN + ' && IsNumeric(evQuote.Text) && Value(evQuote.Text) >= 0 && ' + EV_SEL + '.EventDate > Now()'
parts.append(button('evApprove', 'Approve and request invoices', 690, 496, 260, 40,
    'With({c: ' + EV_REAL + ', rid: "event-" & Text(GUID())}, IfError(Patch(AvenueEventCases, c, {Status: {Value: "Approved"}, QuoteCents: Round(Value(evQuote.Text) * 100, 0), DecidedBy: User().Email, DecidedAt: Now()}); '
    'Patch(AvenueHostRequests, Defaults(AvenueHostRequests), {Title: "EventInvoice", FacilityId: ' + FAC + ', RequestId: rid, Kind: {Value: "EventInvoice"}, '
    'Payload: "{""memberEmail"":""" & Lower(c.MemberId) & """,""packageName"":""" & c.Package.Value & """,""eventDate"":""" & ' + f_local('c.EventDate', 'yyyy-mm-dd') + ' & """,""member"":true}"}); '
    'Set(varEvReq, rid); Notify("Approved. The invoice request went to the server: press Check again for its result.", NotificationType.Success), Notify("Could not approve or send the invoice request.", NotificationType.Error)))',
    DisplayMode='If(' + EV_OK + ', DisplayMode.Edit, DisplayMode.Disabled)', Visible=EV_OPEN))
parts.append(button('evDecline', 'Decline', 960, 496, 140, 40,
    'IfError(Patch(AvenueEventCases, ' + EV_REAL + ', {Status: {Value: "Declined"}, Notes: Trim(Coalesce(' + EV_SEL + '.Notes, "") & Char(10) & "Declined: " & Trim(evReason.Text)), DecidedBy: User().Email, DecidedAt: Now()}); Reset(evReason); '
    'Notify("Declined.", NotificationType.Success), Notify("Could not save.", NotificationType.Error))',
    DisplayMode='If(' + EV_OPEN + ' && !IsBlank(Trim(evReason.Text)), DisplayMode.Edit, DisplayMode.Disabled)', Visible=EV_OPEN, **DANGER))
parts.append(button2('evInvoiced', 'Mark invoiced', 690, 496, 200, 40,
    'IfError(Patch(AvenueEventCases, ' + EV_REAL + ', {Status: {Value: "Invoiced"}}); Notify("Marked invoiced.", NotificationType.Success), Notify("Could not save.", NotificationType.Error))',
    Visible='!IsBlank(' + EV_SEL + ') && ' + EV_SEL + '.Status.Value = "Approved"'))
parts.append(button2('evCheck', 'Check again', 1110, 496, 220, 40, 'Refresh(AvenueHostRequests); Refresh(AvenueEventCases)'))
parts.append(label('evOut', 'If(IsBlank(varEvReq), "", Coalesce(' + EV_HR + '.Outcome, "Waiting for the server... (press Check again)") & If(IsBlank(' + EV_HR + '.Link), "", Char(10) & ' + EV_HR + '.Link))', 690, 546, 640, 64, Size=11, Color=SUBTLE))
parts.append(hint('evHelp', 'If(' + EV_SEL + '.EventDate <= Now(), "This event date has passed, so invoices cannot be requested.", "Approving needs a future event date. Payment stays in Stripe test mode until the client approves (STR-06).")', 690, 616, 640, 40,
                  Visible='!IsBlank(' + EV_SEL + ')'))
# Before Invoiced: correct the recorded quote, or re-open (back to Requested). Re-opening an APPROVED request does not void invoices the server
# already created: the owner voids them in Stripe (test mode). Every change is appended to Notes with who and when.
EV_FIX = '!IsBlank(' + EV_SEL + ') && (' + EV_SEL + '.Status.Value = "Approved" || ' + EV_SEL + '.Status.Value = "Declined")'
EV_WHO = '" by " & User().Email & ", " & Text(Now(), "d mmm yyyy h:mm AM/PM")'
parts.append(button2('evSaveQuote', 'Save quote', 690, 666, 200, 40,
    'IfError(Patch(AvenueEventCases, ' + EV_REAL + ', {QuoteCents: Round(Value(evQuote.Text) * 100, 0), Notes: Trim(Coalesce(' + EV_SEL + '.Notes, "") & Char(10) & "Quote changed to $" & Text(Value(evQuote.Text), "0.00") & ' + EV_WHO + ')}); Notify("Quote saved. Invoices already requested keep the sheet price.", NotificationType.Success), Notify("Could not save.", NotificationType.Error))',
    DisplayMode='If(IsNumeric(evQuote.Text) && Value(evQuote.Text) >= 0, DisplayMode.Edit, DisplayMode.Disabled)', Visible='!IsBlank(' + EV_SEL + ') && ' + EV_SEL + '.Status.Value = "Approved"'))
parts.append(button2('evReopen', 'Re-open (back to Requested)', 900, 666, 260, 40,
    'If(IsBlank(Trim(evReason.Text)), Notify("Write why in the reason box first.", NotificationType.Warning), IfError(Patch(AvenueEventCases, ' + EV_REAL + ', {Status: {Value: "Requested"}, Notes: Trim(Coalesce(' + EV_SEL + '.Notes, "") & Char(10) & "Re-opened: " & Trim(evReason.Text) & ' + EV_WHO + ')}); Reset(evReason); '
    'Notify(If(' + EV_SEL + '.Status.Value = "Approved", "Re-opened. If invoices were already created, the owner voids them in Stripe (test mode).", "Re-opened."), NotificationType.Success), Notify("Could not save.", NotificationType.Error)))',
    Visible=EV_FIX))
write('events.pa.yaml', parts)
_DY = 0


# ---------- Storage (Screen22): fridge, freezer and dry-storage requests (Q-25) ----------
# Reads AvenueStorageCases. Billing is by hand: nothing here creates an invoice or a Stripe object.
STO_SEL = 'stoGal.Selected'
STO_REAL = 'LookUp(AvenueStorageCases, CaseId = ' + STO_SEL + '.CaseId)'
parts = nav('sto', 'Screen12', 'Storage')
_DY = cy('Screen22') - 60
parts.append(button('stoBack', 'Back to More', 20, 60, 140, 34, 'Navigate(Screen12)'))
parts.append(head('stoHead', '"Storage requests"', 180, 60, 400, 20))
parts.append(button2('stoRefresh', 'Refresh', 1190, 60, 140, 34, 'Refresh(AvenueStorageCases)'))
case_chips('sto', 'varStoStage', 'AvenueStorageCases', [('All', 'All'), ('Requested', 'Requested'), ('Approved', 'Approved'), ('Declined', 'Declined')])
parts.append(gallery('stoGal', case_rows('AvenueStorageCases', 'varStoStage', 'Switch(Status.Value, "Requested", 0, "Approved", 1, 2)', '"DecidedAt", SortOrder.Descending'), 20, 150, 640, 580, 66, [
    child('stoItemTitle', 'ThisItem.Item.Value & " × " & Coalesce(Text(ThisItem.Quantity), "?")', 8, 4, 480, 28, FontWeight='FontWeight.Semibold'),
    child('stoItemMeta', 'ThisItem.MemberId & If(Coalesce(ThisItem.MonthlyCents, 0) > 0, " · $" & Text(ThisItem.MonthlyCents / 100, "#,##0.00") & " a month", "")', 8, 34, 480, 22, Size=11, Color=SUBTLE),
    status_pill('stoItemPill', 'ThisItem.Status.Value', ['Requested'], ['Approved'])]))
parts.append(label('stoEmpty', '"No storage requests yet. Members send them from Storage in the portal."', 28, 170, 620, 40, Size=12, Color=SUBTLE, Visible='CountRows(AvenueStorageCases) = 0'))
parts.append(label('stoSelHead', 'If(IsBlank(' + STO_SEL + '), "Select a request", ' + STO_SEL + '.Item.Value & " × " & Coalesce(Text(' + STO_SEL + '.Quantity), "?"))', 690, 150, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(label('stoSelInfo', 'If(IsBlank(' + STO_SEL + '), "", "From " & ' + STO_SEL + '.MemberId & " · " & ' + STO_SEL + '.Status.Value & Char(10) & If(IsBlank(' + STO_SEL + '.Notes), "No notes from the member.", "Notes: " & ' + STO_SEL + '.Notes) & '
                   'If(IsBlank(' + STO_SEL + '.DecidedBy), "", Char(10) & "Decided by " & ' + STO_SEL + '.DecidedBy & " · " & ' + f_local(STO_SEL + '.DecidedAt', 'd mmm yyyy') + '))', 690, 184, 640, 90, Size=12))
parts.append(label('stoPrices', '"Sheet prices: half-door fridge or freezer $250 per door; full door $400 per door or $700 per unit; dry shelf $250 (single unit) or $135 a shelf, $450 and $235 for a double unit; daily dry $50 and daily cold $75 per shelf. The sheet is ambiguous in places: confirm the amount with Flavors before approving."', 690, 280, 640, 76, Size=11, Color=SUBTLE))
parts.append(label('stoAmtCap', '"Monthly amount in dollars"', 690, 364, 300, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(ctl('stoAmt', 'Classic/TextInput', {'Default': 'If(IsBlank(' + STO_SEL + ') || Coalesce(' + STO_SEL + '.MonthlyCents, 0) <= 0, "", Text(' + STO_SEL + '.MonthlyCents / 100, "0.00"))', 'HintText': '"e.g. 250.00"', 'X': 690, 'Y': 386, 'Width': 200, 'Height': 34}))
parts.append(ctl('stoReason', 'Classic/TextInput', {'Default': '""', 'HintText': '"Reason (needed to decline)"', 'Mode': 'TextMode.MultiLine', 'X': 690, 'Y': 430, 'Width': 640, 'Height': 60}))
STO_OPEN = '!IsBlank(' + STO_SEL + ') && ' + STO_SEL + '.Status.Value = "Requested"'
parts.append(button('stoApprove', 'Approve', 690, 502, 200, 40,
    'IfError(Patch(AvenueStorageCases, ' + STO_REAL + ', {Status: {Value: "Approved"}, MonthlyCents: Round(Value(stoAmt.Text) * 100, 0), DecidedBy: User().Email, DecidedAt: Now()}); Notify("Approved. Billing is done by hand.", NotificationType.Success), Notify("Could not save.", NotificationType.Error))',
    DisplayMode='If(' + STO_OPEN + ' && IsNumeric(stoAmt.Text) && Value(stoAmt.Text) > 0, DisplayMode.Edit, DisplayMode.Disabled)', Visible=STO_OPEN))
parts.append(button('stoDecline', 'Decline', 900, 502, 140, 40,
    'IfError(Patch(AvenueStorageCases, ' + STO_REAL + ', {Status: {Value: "Declined"}, Notes: Trim(Coalesce(' + STO_SEL + '.Notes, "") & Char(10) & "Declined: " & Trim(stoReason.Text)), DecidedBy: User().Email, DecidedAt: Now()}); Reset(stoReason); '
    'Notify("Declined.", NotificationType.Success), Notify("Could not save.", NotificationType.Error))',
    DisplayMode='If(' + STO_OPEN + ' && !IsBlank(Trim(stoReason.Text)), DisplayMode.Edit, DisplayMode.Disabled)', Visible=STO_OPEN, **DANGER))
parts.append(hint('stoHelp', '"Nothing is charged or invoiced from this screen: the owner bills storage by hand (Q-25: storage is not confirmed for Phase 1)."', 690, 552, 640, 40))
STO_WHO = '" by " & User().Email & ", " & Text(Now(), "d mmm yyyy h:mm AM/PM")'
parts.append(button2('stoSaveAmt', 'Save amount', 690, 600, 200, 40,
    'IfError(Patch(AvenueStorageCases, ' + STO_REAL + ', {MonthlyCents: Round(Value(stoAmt.Text) * 100, 0), Notes: Trim(Coalesce(' + STO_SEL + '.Notes, "") & Char(10) & "Amount changed to $" & Text(Value(stoAmt.Text), "0.00") & ' + STO_WHO + ')}); Notify("Amount saved.", NotificationType.Success), Notify("Could not save.", NotificationType.Error))',
    DisplayMode='If(IsNumeric(stoAmt.Text) && Value(stoAmt.Text) > 0, DisplayMode.Edit, DisplayMode.Disabled)', Visible='!IsBlank(' + STO_SEL + ') && ' + STO_SEL + '.Status.Value = "Approved"'))
parts.append(button2('stoReopen', 'Re-open (back to Requested)', 900, 600, 260, 40,
    'If(IsBlank(Trim(stoReason.Text)), Notify("Write why in the reason box first.", NotificationType.Warning), IfError(Patch(AvenueStorageCases, ' + STO_REAL + ', {Status: {Value: "Requested"}, Notes: Trim(Coalesce(' + STO_SEL + '.Notes, "") & Char(10) & "Re-opened: " & Trim(stoReason.Text) & ' + STO_WHO + ')}); Reset(stoReason); Notify("Re-opened.", NotificationType.Success), Notify("Could not save.", NotificationType.Error)))',
    Visible='!IsBlank(' + STO_SEL + ') && (' + STO_SEL + '.Status.Value = "Approved" || ' + STO_SEL + '.Status.Value = "Declined")'))
write('storage.pa.yaml', parts)
_DY = 0


# ---------- Applicants (Screen16): membership applications written by the integration host (portal Join or public join page) ----------
parts = nav('app', 'Screen16', 'Applicants')
_DY = cy('Screen16') - 60
APP_EXP = '(Stage.Value = "Expired" || (Stage.Value = "PaymentPending" && !IsBlank(ExpiresAt) && ExpiresAt < Now()))'
APP_SHOWN = lambda r: f'If({r}.Stage.Value = "PaymentPending" && !IsBlank({r}.ExpiresAt) && {r}.ExpiresAt < Now(), "Expired", {r}.Stage.Value)'
APP_LABEL = lambda s: f'Switch({s}, "PaymentPending", "Payment pending", "InviteNeeded", "Invite needed", {s})'
APP_ROWS = ('With({st: Coalesce(varAppStage, "All")}, SortByColumns(Filter(Filter(AvenueApplicants, FacilityId = ' + FAC + '), st = "All" || (st = "Expired" && ' + APP_EXP + ') || '
            '(st <> "Expired" && Stage.Value = st && !' + APP_EXP + ')), "Created", SortOrder.Descending))')
parts.append(button('appBack', 'Back to More', 20, 60, 140, 34, 'Navigate(Screen12)'))
parts.append(label('appHead', '"Membership applications"', 180, 60, 400, 34, FontWeight='FontWeight.Semibold'))
for i, (key, cap) in enumerate([('All', 'All'), ('PaymentPending', 'Payment pending'), ('InviteNeeded', 'Invite needed'), ('Onboarding', 'Onboarding'), ('Active', 'Active'), ('Rejected', 'Rejected'), ('Expired', 'Expired')]):
    on_ = f'Coalesce(varAppStage, "All") = "{key}"'
    parts.append(button(f'appChip{key}', cap, 20 + i * 136, 104, 128, 30, f'Set(varAppStage, "{key}")', Fill=f'If({on_}, {OLIVE}, {SURFACE})', Color=f'If({on_}, {CREAM}, {OLIVE})',
                        BorderColor=OLIVE, BorderThickness=1, HoverFill=f'If({on_}, {OLIVE}, {CREAM})', HoverColor=f'If({on_}, {CREAM}, {OLIVE})', PressedFill=INK2, Size=12,
                        RadiusTopLeft=15, RadiusTopRight=15, RadiusBottomLeft=15, RadiusBottomRight=15))
_sh = APP_SHOWN('ThisItem')
parts.append(gallery('appGal', APP_ROWS, 20, 150, 640, 580, 66, [
    child('appItemTitle', 'Coalesce(ThisItem.BusinessName, "(no business name)") & " · " & Coalesce(ThisItem.ContactName, ThisItem.Email)', 8, 4, 480, 28, FontWeight='FontWeight.Semibold'),
    child('appItemMeta', 'Coalesce(ThisItem.PlanId, "no plan") & " · day " & Coalesce(Text(ThisItem.CollectionDay), "-") & " · " & Coalesce(ThisItem.PayMethod.Value, "-") & If(IsBlank(ThisItem.PaidAt), " · not paid", " · paid " & Text(ThisItem.PaidAt, "d mmm yyyy"))', 8, 34, 480, 24, Size=12, Color=SUBTLE),
    pill('appItemPill', APP_LABEL(_sh), f'Switch({_sh}, "Active", {OKTINT}, "Onboarding", {OKTINT}, "InviteNeeded", {WAITTINT}, "Paid", {WAITTINT}, "PaymentPending", {MUTEDTINT}, {BADTINT})',
         f'Switch({_sh}, "Active", {OKTEXT}, "Onboarding", {OKTEXT}, "InviteNeeded", {WAIT}, "Paid", {WAIT}, "PaymentPending", {MUTED}, {BAD})', 496, 20, 128)]))
SEL = 'appGal.Selected'
SEL_SHOWN = APP_SHOWN(SEL)
parts.append(label('appSelHead', 'If(IsBlank(' + SEL + '), "Select an application", ' + SEL + '.BusinessName & " · " & ' + APP_LABEL(SEL_SHOWN) + ')', 690, 150, 640, 30, FontWeight='FontWeight.Semibold'))
parts.append(label('appSelInfo', 'If(IsBlank(' + SEL + '), "", "Contact: " & Coalesce(' + SEL + '.ContactName, "-") & " · " & ' + SEL + '.Email & " · " & Coalesce(' + SEL + '.Phone, "no phone") & Char(10) & '
    '"Plan: " & Coalesce(' + SEL + '.PlanId, "-") & " · collection day " & Coalesce(Text(' + SEL + '.CollectionDay), "-") & " · pays by " & Coalesce(' + SEL + '.PayMethod.Value, "-") & " · team of " & Coalesce(Text(' + SEL + '.TeamSize), "-") & Char(10) & '
    '"Came from: " & Coalesce(' + SEL + '.Source.Value, "-") & If(IsBlank(' + SEL + '.PaidAt), " · not paid yet", " · paid " & Text(' + SEL + '.PaidAt, "d mmm yyyy h:mm AM/PM")) & '
    'If(IsBlank(' + SEL + '.DecidedBy), "", Char(10) & "Decided by " & ' + SEL + '.DecidedBy & " on " & Text(' + SEL + '.DecidedAt, "d mmm yyyy")) & If(IsBlank(' + SEL + '.Note), "", Char(10) & "Note: " & ' + SEL + '.Note))', 690, 184, 640, 120, Size=12))
parts.append(ctl('appNoteIn', 'Classic/TextInput', {'Default': '""', 'HintText': '"Note (needed to reject; staff only)"', 'Mode': 'TextMode.MultiLine', 'X': 690, 'Y': 312, 'Width': 640, 'Height': 60}))
DECIDE = lambda stage: 'Patch(AvenueApplicants, ' + SEL + ', {Stage: {Value: "' + stage + '"}, DecidedBy: User().Email, DecidedAt: Now(), Note: If(IsBlank(Trim(appNoteIn.Text)), ' + SEL + '.Note, Trim(appNoteIn.Text))})'
APP_REAL = 'LookUp(AvenueApplicants, ApplicantId = ' + SEL + '.ApplicantId)'
APP_WHO = '" (" & User().Email & ", " & Text(Now(), "d mmm yyyy h:mm AM/PM") & ")"'
CANMEM = CAN('ManageMembers')
# Approve: an existing member row becomes Active. With no member row (staff-made or test-mode application), Approve creates one with
# status Onboarding (no booking possible yet) and moves the application to Onboarding; approve again once documents are in.
parts.append(button('appApprove', 'Approve: make active', 690, 384, 210, 40,
    'With({mm: LookUp(AvenueMembers, MemberId = Lower(' + SEL + '.Email))}, If(IsBlank(mm), '
    'IfError(Patch(AvenueMembers, Defaults(AvenueMembers), {Title: Left(Coalesce(' + SEL + '.BusinessName, ' + SEL + '.Email), 255), FacilityId: ' + FAC + ', MemberId: Lower(' + SEL + '.Email), BusinessName: ' + SEL + '.BusinessName, PlanId: ' + SEL + '.PlanId, CollectionDay: ' + SEL + '.CollectionDay, '
    'Status: {Value: "Onboarding"}, PayMethod: If(IsBlank(' + SEL + '.PayMethod.Value), Blank(), {Value: ' + SEL + '.PayMethod.Value}), ChangeReason: "Created from application " & ' + SEL + '.ApplicantId & ' + APP_WHO + '}); ' + DECIDE('Onboarding') + '; Reset(appNoteIn); '
    'Notify("There was no member record, so one was created with status Onboarding (no bookings yet). Press Approve again when the documents are in.", NotificationType.Information), Notify("Could not create the member record.", NotificationType.Error)), '
    'IfError(Patch(AvenueMembers, mm, {Status: {Value: "Active"}, ChangeReason: "Approved from application " & ' + SEL + '.ApplicantId & ' + APP_WHO + '}); ' + DECIDE('Active') + '; Reset(appNoteIn); Notify("Approved. The member can book once their membership card updates (about a minute).", NotificationType.Success), Notify("Could not approve.", NotificationType.Error))))',
    Visible='!IsBlank(' + SEL + ') && (' + SEL_SHOWN + ' = "Onboarding" || ' + SEL_SHOWN + ' = "Paid") && ' + CANMEM))
parts.append(button('appInvited', 'Invite sent: to onboarding', 690, 384, 210, 40,
    'IfError(' + DECIDE('Onboarding') + '; Reset(appNoteIn); Notify("Moved to onboarding. They upload documents after signing in.", NotificationType.Success), Notify("Could not save.", NotificationType.Error))',
    Visible='!IsBlank(' + SEL + ') && ' + SEL_SHOWN + ' = "InviteNeeded" && ' + CANMEM))
parts.append(button('appReject', 'Reject', 910, 384, 140, 40,
    'If(IsBlank(Trim(appNoteIn.Text)), Notify("Write why in the note first.", NotificationType.Warning), IfError(' + DECIDE('Rejected') + '; Reset(appNoteIn); Notify("Rejected. Any refund is done by the owner in Stripe.", NotificationType.Success), Notify("Could not save.", NotificationType.Error)))',
    Visible='!IsBlank(' + SEL + ') && ' + SEL_SHOWN + ' <> "Active" && ' + SEL_SHOWN + ' <> "Rejected" && ' + CANMEM, **DANGER))
# Re-open a rejected or expired application: paid or staff-made ones go back to Invite needed, others to Payment pending for 14 days.
parts.append(button('appReopen', 'Re-open application', 690, 384, 210, 40,
    'If(IsBlank(Trim(appNoteIn.Text)), Notify("Write why in the note first.", NotificationType.Warning), With({paid: !IsBlank(' + SEL + '.PaidAt) || ' + SEL + '.Source.Value = "Staff"}, IfError(Patch(AvenueApplicants, ' + APP_REAL + ', {Stage: {Value: If(paid, "InviteNeeded", "PaymentPending")}, ExpiresAt: If(paid, ' + SEL + '.ExpiresAt, DateAdd(Now(), 14, TimeUnit.Days)), '
    'Note: Trim(Coalesce(' + SEL + '.Note, "") & Char(10) & "Re-opened: " & Trim(appNoteIn.Text) & ' + APP_WHO + ')}); Reset(appNoteIn); Notify("Re-opened.", NotificationType.Success), Notify("Could not re-open.", NotificationType.Error))))',
    Visible='!IsBlank(' + SEL + ') && (' + SEL_SHOWN + ' = "Rejected" || ' + SEL_SHOWN + ' = "Expired") && ' + CANMEM))
RD_APP = 'CountRows(Filter(Filter(AvenueRequiredDocTypes, Active = true) As r, !IsBlank(LookUp(AvenueMemberDocuments, MemberId = Lower(' + SEL + '.Email) && DocType.Value = r.DocType.Value && IsBlank(SupersededBy) && DocStatus.Value <> "Expired"))))'
parts.append(label('appDocs', 'If(IsBlank(' + SEL + '), "", "Documents " & ' + RD_APP + ' & " of " & CountRows(Filter(AvenueRequiredDocTypes, Active = true)) & " required on file")', 1060, 384, 270, 40, Size=12, FontWeight='FontWeight.Bold', Color=OLIVE,
                   VerticalAlign='VerticalAlign.Middle'))
parts.append(label('appHelp', '"Invite needed: a SharePoint admin must send their guest invitation (automatic invites need tenant consent, Q-M3); record it in the checklist below. Rejecting does not refund: the owner refunds in Stripe. Approval does not yet require all documents (Q-05, Q-11)."', 690, 436, 640, 64, Size=11, Color=SUBTLE))

# ----- Edit the application (contact, plan, day, team size) while it is not Active or Rejected -----
APP_EDITABLE = '!IsBlank(' + SEL + ') && ' + SEL_SHOWN + ' <> "Active" && ' + SEL_SHOWN + ' <> "Rejected"'
PLAN_ITEMS = 'ForAll(SortByColumns(Filter(AvenuePlans, FacilityId = ' + FAC + ', Active = true), "PlanId", SortOrder.Ascending), {Value: PlanId})'
_VIS = APP_EDITABLE
parts.append(head('appEdHead', '"Edit application"', 690, 510, 640, 14))
parts.append(ctl('appEdContact', 'Classic/TextInput', {'Default': 'Coalesce(' + SEL + '.ContactName, "")', 'HintText': '"Contact name"', 'X': 690, 'Y': 540, 'Width': 310, 'Height': 36}))
parts.append(ctl('appEdPhone', 'Classic/TextInput', {'Default': 'Coalesce(' + SEL + '.Phone, "")', 'HintText': '"Phone"', 'X': 1010, 'Y': 540, 'Width': 320, 'Height': 36}))
parts.append(ctl('appEdPlan', 'Classic/DropDown', {'Items': PLAN_ITEMS, 'Default': 'Coalesce(' + SEL + '.PlanId, "")', 'AllowEmptySelection': 'true', 'X': 690, 'Y': 584, 'Width': 250, 'Height': 36}))
parts.append(ctl('appEdDay', 'Classic/TextInput', {'Default': 'If(IsBlank(' + SEL + '.CollectionDay), "", Text(' + SEL + '.CollectionDay))', 'HintText': '"Day 1-15"', 'Format': 'TextFormat.Number', 'X': 950, 'Y': 584, 'Width': 110, 'Height': 36}))
parts.append(ctl('appEdTeam', 'Classic/TextInput', {'Default': 'If(IsBlank(' + SEL + '.TeamSize), "", Text(' + SEL + '.TeamSize))', 'HintText': '"Team size"', 'Format': 'TextFormat.Number', 'X': 1070, 'Y': 584, 'Width': 110, 'Height': 36}))
DAY_OK = lambda n: '(IsBlank(Trim(' + n + '.Text)) || (Value(' + n + '.Text) >= 1 && Value(' + n + '.Text) <= 15 && Value(' + n + '.Text) = RoundDown(Value(' + n + '.Text), 0)))'
TEAM_OK = lambda n: '(IsBlank(Trim(' + n + '.Text)) || (Value(' + n + '.Text) >= 1 && Value(' + n + '.Text) <= 50 && Value(' + n + '.Text) = RoundDown(Value(' + n + '.Text), 0)))'
parts.append(button('appEdSave', 'Save changes', 1190, 584, 140, 36,
    'If(!(' + DAY_OK('appEdDay') + ' && ' + TEAM_OK('appEdTeam') + '), Notify("Collection day must be 1 to 15 and team size 1 to 50.", NotificationType.Warning), IfError(Patch(AvenueApplicants, ' + APP_REAL + ', {ContactName: Trim(appEdContact.Text), Phone: Trim(appEdPhone.Text), '
    'PlanId: Coalesce(appEdPlan.Selected.Value, ' + SEL + '.PlanId), CollectionDay: If(IsBlank(Trim(appEdDay.Text)), Blank(), Value(appEdDay.Text)), TeamSize: If(IsBlank(Trim(appEdTeam.Text)), Blank(), Value(appEdTeam.Text)), '
    'Note: Trim(Coalesce(' + SEL + '.Note, "") & Char(10) & "Edited" & ' + APP_WHO + ' & If(IsBlank(Trim(appNoteIn.Text)), "", ": " & Trim(appNoteIn.Text)))}); Reset(appNoteIn); Notify("Application saved. The e-mail cannot be changed (it becomes the sign-in): reject and create a new application instead.", NotificationType.Success), Notify("Could not save.", NotificationType.Error)))',
    Visible=APP_EDITABLE + ' && ' + CANMEM))

# ----- Invite checklist: recorded by staff (the invitation itself is a manual SharePoint admin step until Q-M3) -----
parts.append(head('appInvHead', '"Invite checklist (recorded by staff)"', 690, 634, 640, 14))
for i, (fld, cap) in enumerate([('InviteSent', 'Invite sent'), ('InviteAccepted', 'Invite accepted'), ('GroupAdded', 'In Members group')]):
    x = 690 + i * 214
    parts.append(label(f'app{fld}Lbl', f'"{cap}"', x, 664, 120, 32, Size=12, VerticalAlign='VerticalAlign.Middle'))
    parts.append(ctl(f'app{fld}', 'Classic/Toggle', {'Default': 'Coalesce(' + SEL + '.' + fld + ', false)', 'X': x + 120, 'Y': 666, 'Width': 84, 'Height': 30}))
parts.append(button2('appInvSave', 'Save checklist', 690, 706, 200, 36,
    'IfError(Patch(AvenueApplicants, ' + APP_REAL + ', {InviteSent: appInviteSent.Value, InviteAccepted: appInviteAccepted.Value, GroupAdded: appGroupAdded.Value, '
    'Note: Trim(Coalesce(' + SEL + '.Note, "") & Char(10) & "Checklist: sent " & If(appInviteSent.Value, "yes", "no") & ", accepted " & If(appInviteAccepted.Value, "yes", "no") & ", group " & If(appGroupAdded.Value, "yes", "no") & ' + APP_WHO + ')}); Notify("Checklist saved.", NotificationType.Success), Notify("Could not save.", NotificationType.Error))',
    Visible=APP_EDITABLE + ' && ' + CANMEM))
_VIS = None

# ----- New application made by staff (Source "Staff", no payment link; starts at Invite needed) -----
parts.append(panel('appNewPanel', 16, 750, 656, 200))
parts.append(head('appNewHead', '"New application (made by staff)"', 32, 760, 600, 14))
parts.append(ctl('appNewBiz', 'Classic/TextInput', {'Default': '""', 'HintText': '"Business name"', 'X': 32, 'Y': 792, 'Width': 300, 'Height': 36}))
parts.append(ctl('appNewContact', 'Classic/TextInput', {'Default': '""', 'HintText': '"Contact name"', 'X': 342, 'Y': 792, 'Width': 314, 'Height': 36}))
parts.append(ctl('appNewEmail', 'Classic/TextInput', {'Default': '""', 'HintText': '"Sign-in e-mail"', 'X': 32, 'Y': 836, 'Width': 300, 'Height': 36}))
parts.append(ctl('appNewPhone', 'Classic/TextInput', {'Default': '""', 'HintText': '"Phone (optional)"', 'X': 342, 'Y': 836, 'Width': 314, 'Height': 36}))
parts.append(ctl('appNewPlan', 'Classic/DropDown', {'Items': PLAN_ITEMS, 'AllowEmptySelection': 'true', 'Default': '""', 'X': 32, 'Y': 880, 'Width': 240, 'Height': 36}))
parts.append(ctl('appNewDay', 'Classic/TextInput', {'Default': '""', 'HintText': '"Day 1-15"', 'Format': 'TextFormat.Number', 'X': 282, 'Y': 880, 'Width': 100, 'Height': 36}))
parts.append(ctl('appNewTeam', 'Classic/TextInput', {'Default': '"1"', 'HintText': '"Team"', 'Format': 'TextFormat.Number', 'X': 392, 'Y': 880, 'Width': 80, 'Height': 36}))
APP_NEW_OK = '!IsBlank(Trim(appNewBiz.Text)) && !IsBlank(Trim(appNewContact.Text)) && IsMatch(Trim(appNewEmail.Text), Match.Email) && !IsBlank(appNewPlan.Selected.Value) && ' + DAY_OK('appNewDay') + ' && ' + TEAM_OK('appNewTeam')
parts.append(button('appNewAdd', 'Create application', 482, 880, 174, 36,
    'If(!IsBlank(LookUp(AvenueMembers, MemberId = Lower(Trim(appNewEmail.Text)))), Notify("This e-mail already has a member record: edit it in Member admin.", NotificationType.Warning), '
    'IfError(Patch(AvenueApplicants, Defaults(AvenueApplicants), {Title: Left(Trim(appNewBiz.Text), 255), FacilityId: ' + FAC + ', ApplicantId: "app-staff-" & Text(GUID()), Email: Lower(Trim(appNewEmail.Text)), BusinessName: Trim(appNewBiz.Text), ContactName: Trim(appNewContact.Text), Phone: Trim(appNewPhone.Text), '
    'PlanId: appNewPlan.Selected.Value, CollectionDay: If(IsBlank(Trim(appNewDay.Text)), Blank(), Value(appNewDay.Text)), TeamSize: If(IsBlank(Trim(appNewTeam.Text)), 1, Value(appNewTeam.Text)), Stage: {Value: "InviteNeeded"}, Source: {Value: "Staff"}, '
    'InviteSent: false, InviteAccepted: false, GroupAdded: false, Note: "Created by staff" & ' + APP_WHO + ' & ". No payment link was sent; payment is arranged outside Avenue until STR-06."}); '
    'Reset(appNewBiz); Reset(appNewContact); Reset(appNewEmail); Reset(appNewPhone); Reset(appNewPlan); Reset(appNewDay); Reset(appNewTeam); Notify("Application created at Invite needed.", NotificationType.Success), Notify("Could not create the application.", NotificationType.Error)))',
    DisplayMode='If(' + APP_NEW_OK + ', DisplayMode.Edit, DisplayMode.Disabled)', Visible=CANMEM))
parts.append(hint('appNewHelp', '"Plan, contact, e-mail and day are required. [PROPOSED] staff-made applications skip payment (Stripe stays in test mode, STR-06)."', 32, 920, 624, 24, Size=10))

# ----- Onboarding pipeline: every open application by stage (Applied -> Paid/Skipped -> Invited -> Documents -> Approved -> Active) -----
# Stage rules: Applied = payment pending (not expired); Paid/Skipped = paid or test-mode skip, invite not sent; Invited = invite sent, not yet
# accepted and in the Members group (portal applicants are already signed in, so they skip this); Documents = onboarding, N of M documents;
# Approved = application Active but the member row is not Active yet; Active = member row Active. Rejected and expired are left out.
INV_DONE = '(Source.Value = "Portal" || (InviteAccepted = true && GroupAdded = true))'
PIPE = ('AddColumns(Filter(AvenueApplicants, FacilityId = ' + FAC + '), PipeDocs, With({em: Lower(Email)}, CountRows(Filter(Filter(AvenueRequiredDocTypes, Active = true) As r, '
        '!IsBlank(LookUp(AvenueMemberDocuments, MemberId = em && DocType.Value = r.DocType.Value && IsBlank(SupersededBy) && DocStatus.Value <> "Expired"))))), '
        'PipeStage, With({st: Stage.Value, em: Lower(Email)}, If(st = "PaymentPending" && (IsBlank(ExpiresAt) || ExpiresAt > Now()), "Applied", '
        'st = "Paid" || (st = "InviteNeeded" && InviteSent <> true), "Paid", st = "InviteNeeded" || (st = "Onboarding" && !' + INV_DONE + '), "Invited", '
        'st = "Onboarding", "Documents", st = "Active", If(LookUp(AvenueMembers, MemberId = em).Status.Value = "Active", "Active", "Approved"), "Closed")))')
parts.append(head('appPipeHead', '"Onboarding pipeline"', 24, 970, 800, 18))
parts.append(hint('appPipeHelp', '"Every open application by stage. Select it in the list above to act on it. Documents counts only the required types (Setup)."', 24, 1000, 1300, 22))
for i, (key, cap) in enumerate([('Applied', 'Applied'), ('Paid', 'Paid / skipped'), ('Invited', 'Invited'), ('Documents', 'Documents'), ('Approved', 'Approved'), ('Active', 'Active')]):
    x = 20 + i * 222
    parts.append(panel(f'appPipe{key}Panel', x, 1030, 214, 340))
    parts.append(label(f'appPipe{key}Cap', f'"{cap} (" & CountRows(appPipe{key}Gal.AllItems) & ")"', x + 12, 1038, 190, 26, Size=12, FontWeight='FontWeight.Bold', Color=OLIVE))
    parts.append(gallery(f'appPipe{key}Gal', f'Filter({PIPE}, PipeStage = "{key}")', x + 4, 1068, 206, 296, 52, [
        child(f'appPipe{key}Name', 'Coalesce(ThisItem.BusinessName, ThisItem.Email)', 6, 2, 190, 24, Size=11, FontWeight='FontWeight.Semibold'),
        child(f'appPipe{key}Meta', 'Coalesce(ThisItem.Source.Value, "-") & " · docs " & ThisItem.PipeDocs & " of " & CountRows(Filter(AvenueRequiredDocTypes, Active = true))', 6, 26, 190, 20, Size=9, Color=SUBTLE)]))
write('applicants.pa.yaml', parts)
_DY = 0


PREV_EPERIOD = ('With({curP: ' + EPERIOD + '}, With({y: Value(Left(curP, 4)), m: Value(Right(curP, 2))}, '
                'If(m = 1, Text(y - 1) & "-12", Text(y) & "-" & If(m - 1 < 10, "0", "") & Text(m - 1))))')

# ---------- Permissions (Screen17): owner edits which staff may use which screens (ADM-02, Q-15) ----------
# [PROPOSED] capability set. This hides buttons only: SharePoint still lets staff edit lists, so real enforcement needs checks in the flows or list permissions (Q-15).
CAPS = [('ApproveBookings', 'Approve bookings'), ('ManageDocuments', 'Review documents'), ('ViewPayments', 'See payments'), ('ManageMembers', 'Manage members'),
        ('PostNotices', 'Post notices'), ('ManageEquipment', 'Edit equipment'), ('ViewEnvironment', 'See sensors')]
PER_SEL = 'perGal.Selected'
PER_REAL = 'LookUp(AvenueStaffCapabilities, StaffEmail = perGal.Selected.StaffEmail)'
parts = nav('per', 'Screen12', 'Permissions')
_DY = cy('Screen17') - 60
parts.append(button('perBack', 'Back to More', 20, 60, 140, 34, 'Navigate(Screen12)'))
parts.append(head('perHead', '"Staff permissions"', 180, 60, 400, 20))
parts.append(label('perNote', '"These switches hide buttons for each staff member; they do not stop a staff account from changing data directly in SharePoint. Real enforcement is a flow and list-permission task, and the list of capabilities is not decided (Q-15)."', 20, 100, 1310, 40, Size=11, Color=SUBTLE))
parts.append(label('perDenied', '"Only the Flavors owner can change permissions."', 20, 150, 700, 30, Size=13, FontWeight='FontWeight.Semibold', Visible='!(' + OWNER_SN + ')'))
_VIS = OWNER_SN
parts.append(gallery('perGal', 'SortByColumns(Filter(AvenueStaffCapabilities, FacilityId = ' + FAC + '), "StaffEmail", SortOrder.Ascending)', 20, 150, 640, 420, 56, [
    child('perRowEmail', 'ThisItem.StaffEmail', 8, 4, 600, 26, FontWeight='FontWeight.Semibold'),
    child('perRowMeta', 'Text(' + ' + '.join('If(ThisItem.' + k + ', 1, 0)' for k, _ in CAPS) + ') & " of 7 allowed" & If(IsBlank(ThisItem.Note), "", " · " & ThisItem.Note)', 8, 30, 600, 22, Size=11, Color=SUBTLE)]))
parts.append(label('perEmpty', '"No staff rows yet. Add a staff e-mail below to start."', 28, 170, 620, 30, Size=12, Color=SUBTLE, Visible='CountRows(AvenueStaffCapabilities) = 0 && ' + OWNER_SN))
parts.append(ctl('perNew', 'Classic/TextInput', {'Default': '""', 'HintText': '"Staff e-mail to add"', 'X': 20, 'Y': 586, 'Width': 380, 'Height': 34}))
PER_NEW_OK = 'IsMatch(Trim(perNew.Text), Match.Email) && IsBlank(LookUp(AvenueStaffCapabilities, StaffEmail = Lower(Trim(perNew.Text))))'
parts.append(button('perAdd', 'Add staff member', 410, 586, 200, 34,
    'IfError(Patch(AvenueStaffCapabilities, Defaults(AvenueStaffCapabilities), {Title: Lower(Trim(perNew.Text)), FacilityId: ' + FAC + ', StaffEmail: Lower(Trim(perNew.Text)), ' + ', '.join(k + ': false' for k, _ in CAPS) + '}); '
    'Reset(perNew); Notify("Added with every capability off. Switch on what they may do and Save.", NotificationType.Success), Notify("Could not add the row.", NotificationType.Error))',
    DisplayMode='If(' + PER_NEW_OK + ', DisplayMode.Edit, DisplayMode.Disabled)'))
parts.append(hint('perAddHelp', 'If(IsBlank(Trim(perNew.Text)), "", If(!IsMatch(Trim(perNew.Text), Match.Email), "Enter a valid e-mail.", If(IsBlank(LookUp(AvenueStaffCapabilities, StaffEmail = Lower(Trim(perNew.Text)))), "", "This person is already in the list.")))', 20, 624, 590, 22, Color=BAD))
parts.append(head('perSelHead', 'If(IsBlank(' + PER_SEL + '), "Select a staff member", ' + PER_SEL + '.StaffEmail)', 690, 150, 640, 30))
for i, (k, cap) in enumerate(CAPS):
    y = 196 + i * 40
    parts.append(label(f'perCap{i}', f'"{cap}"', 690, y, 300, 34, Size=13, VerticalAlign='VerticalAlign.Middle'))
    parts.append(ctl(f'perTg{i}', 'Classic/Toggle', {'Default': 'If(IsBlank(' + PER_SEL + '), false, ' + PER_SEL + '.' + k + ')', 'TrueText': '"Allowed"', 'FalseText': '"Blocked"', 'X': 1000, 'Y': y, 'Width': 160, 'Height': 34}))
parts.append(button('perSave', 'Save', 690, 488, 200, 38,
    'IfError(Patch(AvenueStaffCapabilities, ' + PER_REAL + ', {' + ', '.join(f'{k}: perTg{i}.Value' for i, (k, _) in enumerate(CAPS)) + '}); Notify("Saved.", NotificationType.Success), Notify("Could not save.", NotificationType.Error))',
    DisplayMode='If(!IsBlank(' + PER_SEL + '), DisplayMode.Edit, DisplayMode.Disabled)'))
parts.append(button2('perOff', 'Deactivate (all off)', 900, 488, 220, 38,
    'IfError(Patch(AvenueStaffCapabilities, ' + PER_REAL + ', {' + ', '.join(k + ': false' for k, _ in CAPS) + ', Note: "Deactivated by " & User().Email & " on " & Text(Today(), "d mmm yyyy")}); Notify("Deactivated: every capability is off. The row is kept.", NotificationType.Success), Notify("Could not save.", NotificationType.Error))',
    DisplayMode='If(!IsBlank(' + PER_SEL + '), DisplayMode.Edit, DisplayMode.Disabled)'))
parts.append(hint('perHelp', '"Rows are never deleted. Deactivate turns every capability off and keeps the history."', 690, 534, 640, 24))
_VIS = None
write('permissions.pa.yaml', parts)
_DY = 0


# ---------- Reports (Screen18): read-only summaries from the live lists (RPT-01/04). Measure definitions are not final (Q-16). ----------
REP_BUILD = ('ClearCollect(colRepB, AddColumns(Filter(AvenueBookings, FacilityId = ' + FAC + ', Status.Value = "Approved", StartUtc >= DateAdd(Now(), -190, TimeUnit.Days)), '
             'Mon, Text(StartUtc, "yyyy-mm"), Hrs, DateDiff(StartUtc, EndUtc, TimeUnit.Minutes) / 60)); '
             'ClearCollect(colRepM, AddColumns(GroupBy(colRepB, Mon, Rows), N, CountRows(Rows), H, Sum(Rows, Hrs)))')
REP_NOW = 'With({p: Text(Today(), "yyyy-mm")}, '
parts = nav('rpt', 'Screen12', 'Reports')
_DY = cy('Screen18') - 60
parts.append(button('rptBack', 'Back to More', 20, 60, 140, 34, 'Navigate(Screen12)'))
parts.append(head('rptHead', '"Reports"', 180, 60, 300, 20))
parts.append(button2('rptRefresh', 'Refresh', 1190, 60, 140, 34, 'Refresh(AvenueBookings); Refresh(AvenueInvoices); Refresh(AvenueMemberDocuments); ' + REP_BUILD))
parts.append(ctl('rptInit', 'Timer', {'Duration': 600, 'AutoStart': 'true', 'Repeat': 'false', 'Visible': 'false', 'OnTimerEnd': REP_BUILD, 'X': 0, 'Y': 0, 'Width': 10, 'Height': 10}))
parts.append(label('rptNote', '"Booked hours are the hours on approved bookings, not hours attended. Months follow this device\'s clock, so a booking near midnight on the 1st can count in the neighbouring month. What each report should measure is not final (Q-16)."', 20, 98, 1310, 40, Size=11, Color=SUBTLE))
_tile('rpt', 0, 'Documents current', 'Text(CountRows(Filter(AvenueMemberDocuments, DocStatus.Value = "Current", IsBlank(SupersededBy))))', 'newest upload per type, in date', y=140)
_tile('rpt', 1, 'Documents expiring', 'Text(CountRows(Filter(AvenueMemberDocuments, DocStatus.Value = "Expiring", IsBlank(SupersededBy))))', 'inside the 30-day warning window', y=140)
_tile('rpt', 2, 'Documents expired', 'Text(CountRows(Filter(AvenueMemberDocuments, DocStatus.Value = "Expired", IsBlank(SupersededBy))))', 'not renewed: bookings are blocked', y=140)
_tile('rpt', 3, 'Invoices overdue', MONEY('Sum(Filter(' + INV + ', ' + OVERDUE + '), AmountDueCents)'), 'open and past the due date (Stripe test mode)', y=140)
_tile('rpt', 4, 'Invoices paid this month', MONEY('Sum(Filter(' + INV + ', Status.Value = "paid", DueDate >= ' + MS + ', DueDate < ' + NM + '), AmountPaidCents)'), 'invoices due this month', y=248)
_tile('rpt', 5, 'Invoices open this month', MONEY('Sum(Filter(' + INV + ', Status.Value = "open", DueDate >= ' + MS + ', DueDate < ' + NM + '), AmountDueCents)'), 'due this month, not paid yet', y=248)
_tile('rpt', 6, 'Approved bookings this month', REP_NOW + 'Text(Coalesce(LookUp(colRepM, Mon = p).N, 0)))', 'from the table below', y=248)
_tile('rpt', 7, 'Booked hours this month', REP_NOW + 'Text(Round(Coalesce(LookUp(colRepM, Mon = p).H, 0), 1)) & " h")', 'approved bookings, not attendance', y=248)
parts.append(head('rptMonHead', '"Bookings and booked hours per month (last 6 months)"', 20, 366, 640, 14))
for i, (cap, x, w) in enumerate([('Month', 28, 120), ('Bookings', 170, 110), ('Booked hours', 300, 130), ('Hours per booking', 450, 190)]):
    parts.append(label(f'rptMonCap{i}', f'"{cap}"', x, 396, w, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(gallery('rptMonGal', 'SortByColumns(colRepM, "Mon", SortOrder.Descending)', 20, 418, 640, 200, 32, [
    child('rptMonMon', 'ThisItem.Mon', 8, 4, 120, 24, FontWeight='FontWeight.Semibold'),
    child('rptMonN', 'Text(ThisItem.N)', 150, 4, 110, 24),
    child('rptMonH', 'Text(Round(ThisItem.H, 1)) & " h"', 280, 4, 130, 24),
    child('rptMonAvg', 'If(ThisItem.N = 0, "–", Text(Round(ThisItem.H / Max(1, ThisItem.N), 1)) & " h")', 430, 4, 190, 24)]))
parts.append(head('rptH1Head', '"Hours used this month by member (facility month)"', 690, 366, 640, 14))
parts.append(gallery('rptH1Gal', 'With({p: ' + EPERIOD + '}, SortByColumns(AddColumns(GroupBy(Filter(AvenueHoursLedger, Period = p), MemberId, Rows), Total, Sum(Rows, Hours)), "Total", SortOrder.Descending))', 690, 396, 640, 222, 32, [
    child('rptH1Member', 'ThisItem.MemberId', 8, 4, 440, 24),
    child('rptH1Total', 'Text(Round(ThisItem.Total, 1)) & " h"', 460, 4, 160, 24, Align='Align.Right')]))
parts.append(head('rptEqHead', '"Equipment booked hours this month (approved bookings)"', 20, 640, 640, 14))
parts.append(gallery('rptEqGal', 'ForAll(Filter(AvenueEquipment, FacilityId = ' + FAC + ', Active = true) As q, {Name: q.Title, Hours: Sum(Filter(Filter(AvenueBookings, Status.Value = "Approved", StartUtc >= DateValue(Text(Today(), "yyyy-mm") & "-01")), q.EquipmentId in EquipmentIds), DateDiff(StartUtc, EndUtc, TimeUnit.Minutes) / 60)})', 20, 670, 640, 300, 32, [
    child('rptEqName', 'ThisItem.Name', 8, 4, 440, 24),
    child('rptEqHours', 'Text(Round(ThisItem.Hours, 1)) & " h"', 460, 4, 160, 24, Align='Align.Right')]))
parts.append(head('rptH2Head', '"Hours used last month by member (facility month)"', 690, 640, 640, 14))
parts.append(gallery('rptH2Gal', 'With({p: ' + PREV_EPERIOD + '}, SortByColumns(AddColumns(GroupBy(Filter(AvenueHoursLedger, Period = p), MemberId, Rows), Total, Sum(Rows, Hours)), "Total", SortOrder.Descending))', 690, 670, 640, 300, 32, [
    child('rptH2Member', 'ThisItem.MemberId', 8, 4, 440, 24),
    child('rptH2Total', 'Text(Round(ThisItem.Total, 1)) & " h"', 460, 4, 160, 24, Align='Align.Right')]))
write('reports.pa.yaml', parts)


# ---------- Member admin (Screen23): member list left; Profile | Hours ledger | Documents | Team for the selected member right ----------
# New screen so the frozen Members/Compliance/Payments screens stay byte-identical. Members are never deleted: Deactivate (same logic as Screen8).
# Capability toggles (CAN) only hide buttons; SharePoint permissions and the flows are the real boundary (Q-15).
parts = nav('ma', 'Screen12', 'Member admin')
_DY = cy('Screen23') - 60
MA_SEL = 'maGal.Selected'
MA_REAL = 'LookUp(AvenueMembers, MemberId = ' + MA_SEL + '.MemberId)'
MA_WHO = '" (" & User().Email & ", " & Text(Now(), "d mmm yyyy h:mm AM/PM") & ")"'
CANM, CAND = CAN('ManageMembers'), CAN('ManageDocuments')
parts.append(button('maBack', 'Back to More', 20, 60, 140, 34, 'Navigate(Screen12)'))
parts.append(head('maHead', '"Member admin"', 180, 60, 400, 20))
parts.append(button2('maRefresh', 'Refresh', 1190, 60, 140, 34, 'Refresh(AvenueMembers); Refresh(AvenueHoursLedger); Refresh(AvenueMemberDocuments); Refresh(AvenueDocumentSubmissions)'))
# Search: text with "@" searches the sign-in e-mail, otherwise the start of the business name (StartsWith is delegable; no OR inside Filter).
parts.append(ctl('maSearch', 'Classic/TextInput', {'Default': '""', 'HintText': '"Search: business name start, or e-mail"', 'X': 20, 'Y': 104, 'Width': 640, 'Height': 36}))
MA_ROWS = ('With({s: Trim(maSearch.Text)}, SortByColumns(If(IsBlank(s), Filter(AvenueMembers, FacilityId = ' + FAC + '), IsMatch(s, "@", MatchOptions.Contains), '
           'Filter(AvenueMembers, FacilityId = ' + FAC + ', StartsWith(MemberId, Lower(s))), Filter(AvenueMembers, FacilityId = ' + FAC + ', StartsWith(BusinessName, s))), "BusinessName", SortOrder.Ascending))')
parts.append(gallery('maGal', MA_ROWS, 20, 150, 640, 500, 60, [
    child('maItemTitle', 'Coalesce(ThisItem.BusinessName, "(no business name)") & " · " & ThisItem.MemberId', 8, 4, 600, 26, FontWeight='FontWeight.Semibold'),
    child('maItemMeta', 'ThisItem.Status.Value & " · plan " & Coalesce(ThisItem.PlanId, "not set") & If(IsBlank(ThisItem.CollectionDay), "", " · day " & ThisItem.CollectionDay)', 8, 32, 600, 22, Size=12,
          Color='If(ThisItem.Status.Value = "Inactive", ' + BAD + ', ' + SUBTLE + ')')]))
# New member: starts at Onboarding (cannot book until made Active here or approved in Applicants). Site access is a SharePoint admin step.
parts.append(head('maNewHead', '"Add a member (starts as Onboarding)"', 20, 664, 640, 14))
parts.append(ctl('maNewBiz', 'Classic/TextInput', {'Default': '""', 'HintText': '"Business name"', 'X': 20, 'Y': 694, 'Width': 300, 'Height': 36}))
parts.append(ctl('maNewEmail', 'Classic/TextInput', {'Default': '""', 'HintText': '"Member sign-in e-mail"', 'X': 330, 'Y': 694, 'Width': 330, 'Height': 36}))
parts.append(button('maAdd', 'Add member', 20, 740, 180, 38,
    'If(!IsBlank(LookUp(AvenueMembers, MemberId = Lower(Trim(maNewEmail.Text)))), Notify("This e-mail is already a member.", NotificationType.Warning), IfError(Patch(AvenueMembers, Defaults(AvenueMembers), {Title: Left(Trim(maNewBiz.Text), 255), FacilityId: ' + FAC + ', '
    'MemberId: Lower(Trim(maNewEmail.Text)), BusinessName: Trim(maNewBiz.Text), Status: {Value: "Onboarding"}, ChangeReason: "Added by staff" & ' + MA_WHO + '}); Reset(maNewBiz); Reset(maNewEmail); '
    'Notify("Member added as Onboarding. Set the plan and day, then make them Active when ready. A SharePoint admin grants site access.", NotificationType.Success), Notify("Could not add the member.", NotificationType.Error)))',
    DisplayMode='If(!IsBlank(Trim(maNewBiz.Text)) && IsMatch(Trim(maNewEmail.Text), Match.Email), DisplayMode.Edit, DisplayMode.Disabled)', Visible=CANM))

# Tabs for the selected member
TABS = [('profile', 'Profile'), ('ledger', 'Hours ledger'), ('docs', 'Documents'), ('team', 'Team')]
MV = {k: f'Coalesce(varMaTab, "profile") = "{k}"' for k, _ in TABS}
for i, (k, cap) in enumerate(TABS):
    parts.append(button(f'maTab{k.capitalize()}', cap, 690 + i * 162, 104, 154, 36, f'Set(varMaTab, "{k}")', Fill=f'If({MV[k]}, {OLIVE}, {SURFACE})', Color=f'If({MV[k]}, {CREAM}, {OLIVE})',
                        BorderColor=OLIVE, BorderThickness=1, HoverFill=f'If({MV[k]}, {OLIVE}, {CREAM})', HoverColor=f'If({MV[k]}, {CREAM}, {OLIVE})', PressedFill=INK2, Size=12))
parts.append(label('maSelHead', 'If(IsBlank(' + MA_SEL + '), "Select a member on the left", ' + MA_SEL + '.BusinessName & " · " & ' + MA_SEL + '.Status.Value)', 690, 150, 640, 30, FontWeight='FontWeight.Semibold'))

# ----- Profile -----
_VIS = MV['profile']
parts.append(label('maInfo', 'If(IsBlank(' + MA_SEL + '), "", "Sign-in " & ' + MA_SEL + '.MemberId & Char(10) & "Pays by " & Coalesce(' + MA_SEL + '.PayMethod.Value, "-") & " · payment status " & Coalesce(' + MA_SEL + '.PaymentStatus.Value, "-") & Char(10) & '
                   '"Stripe customer " & Coalesce(' + MA_SEL + '.StripeCustomerId, "-") & " · subscription " & Coalesce(' + MA_SEL + '.SubscriptionId, "-") & " (read only: Stripe owns these)")', 690, 184, 640, 64, Size=11, Color=SUBTLE))
parts.append(label('maBizLbl', '"Business name"', 690, 254, 300, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(ctl('maBiz', 'Classic/TextInput', {'Default': 'Coalesce(' + MA_SEL + '.BusinessName, "")', 'X': 690, 'Y': 276, 'Width': 640, 'Height': 36}))
parts.append(label('maPlanLbl', '"Plan (active plans; empty keeps the current one)"', 690, 320, 300, 20, Size=11, FontWeight='FontWeight.Bold', Color=SUBTLE))
parts.append(ctl('maPlan', 'Classic/DropDown', {'Items': 'ForAll(SortByColumns(Filter(AvenuePlans, FacilityId = ' + FAC + ', Active = true), "PlanId", SortOrder.Ascending), {Value: PlanId})', 'Default': 'Coalesce(' + MA_SEL + '.PlanId, "")',
                                                 'AllowEmptySelection': 'true', 'X': 690, 'Y': 342, 'Width': 300, 'Height': 36}))
parts.append(ctl('maDay', 'Classic/TextInput', {'Default': 'If(IsBlank(' + MA_SEL + '.CollectionDay), "", Text(' + MA_SEL + '.CollectionDay))', 'HintText': '"Day 1-15"', 'Format': 'TextFormat.Number', 'X': 1000, 'Y': 342, 'Width': 120, 'Height': 36}))
parts.append(ctl('maStatus', 'Classic/DropDown', {'Items': 'If(' + MA_SEL + '.Status.Value = "Inactive", ["Inactive", "Invited", "Paid", "Onboarding", "Active"], ["Invited", "Paid", "Onboarding", "Active"])',
                                                   'Default': 'Coalesce(' + MA_SEL + '.Status.Value, "Onboarding")', 'X': 1130, 'Y': 342, 'Width': 200, 'Height': 36}))
parts.append(ctl('maReason', 'Classic/TextInput', {'Default': '""', 'HintText': '"Reason (required for any status change and to deactivate)"', 'X': 690, 'Y': 390, 'Width': 640, 'Height': 36}))
MA_CHANGED = 'maStatus.Selected.Value <> ' + MA_SEL + '.Status.Value'
MA_DAY_OK = '(IsBlank(Trim(maDay.Text)) || (Value(maDay.Text) >= 1 && Value(maDay.Text) <= 15 && Value(maDay.Text) = RoundDown(Value(maDay.Text), 0)))'
parts.append(button('maSave', 'Save', 690, 438, 160, 40,
    'If(!' + MA_DAY_OK + ', Notify("Collection day must be a whole number from 1 to 15.", NotificationType.Warning), IfError(Patch(AvenueMembers, ' + MA_REAL + ', {Title: Left(Trim(maBiz.Text), 255), BusinessName: Trim(maBiz.Text), '
    'PlanId: Coalesce(maPlan.Selected.Value, ' + MA_SEL + '.PlanId), CollectionDay: If(IsBlank(Trim(maDay.Text)), Blank(), Value(maDay.Text)), Status: {Value: maStatus.Selected.Value}, '
    'ChangeReason: If(IsBlank(Trim(maReason.Text)), ' + MA_SEL + '.ChangeReason, Trim(maReason.Text) & ' + MA_WHO + ')}); Reset(maReason); Notify("Member saved. Their membership card updates within a minute.", NotificationType.Success), Notify("Could not save the member.", NotificationType.Error)))',
    DisplayMode='If(IsBlank(' + MA_SEL + ') || IsBlank(Trim(maBiz.Text)) || (' + MA_CHANGED + ' && IsBlank(Trim(maReason.Text))), DisplayMode.Disabled, DisplayMode.Edit)', Visible=MV['profile'] + ' && ' + CANM))
parts.append(button('maDeactivate', 'Deactivate and cancel future bookings', 860, 438, 360, 40, DEACT('maGal.Selected', 'maReason'),
    DisplayMode='If(IsBlank(' + MA_SEL + ') || ' + MA_SEL + '.Status.Value = "Inactive" || IsBlank(Trim(maReason.Text)), DisplayMode.Disabled, DisplayMode.Edit)', Fill=BAD, Color=SURFACE, Visible=MV['profile'] + ' && ' + CANM))
parts.append(hint('maHelp', '"Members are never deleted. Deactivate keeps all history and ends the Stripe subscription at the end of the paid period; removing site access is a SharePoint admin step. Plan changes here do not change Stripe (STR-06, Q-R2)."', 690, 488, 640, 48))

# DEMO ONLY - REMOVE BEFORE GO-LIVE (developer decision 23 Nov 2026, docs/DECISIONS_AND_OPEN_QUESTIONS.md): wipes one member's rows so a demo member can start
# again from Join. Typed e-mail must match the selected member. Rows are deleted by the Power Apps connector (permanent: NOT in the recycle bin; verified 24 Nov 2026). It does not delete the Entra guest or the site user.
parts.append(head('maWipeHead', '"Demo reset (temporary, removed before go-live)"', 690, 556, 640, 14, Visible=MV['profile'] + ' && ' + CANM))
parts.append(ctl('maWipeConfirm', 'Classic/TextInput', {'Default': '""', 'HintText': '"Type the member\'s e-mail to confirm"', 'X': 690, 'Y': 584, 'Width': 440, 'Height': 36, 'Visible': MV['profile'] + ' && ' + CANM}))
_WK = 'Lower(maGal.Selected.MemberId)'
parts.append(button('maWipe', 'Delete this member and all their data', 1140, 584, 190, 36,
    'With({k: ' + _WK + '}, IfError(RemoveIf(AvenueBookings, MemberId = k); RemoveIf(AvenueHoursLedger, MemberId = k); RemoveIf(AvenueMemberDocuments, MemberId = k); RemoveIf(AvenueCheckIns, MemberId = k); '
    'RemoveIf(AvenueInvoices, MemberId = k); RemoveIf(AvenueSupportCases, MemberId = k); RemoveIf(AvenueEventCases, MemberId = k); RemoveIf(AvenueStorageCases, MemberId = k); RemoveIf(AvenueComplianceCases, MemberId = k); '
    'RemoveIf(AvenueApplicants, Email = k); RemoveIf(AvenueBookingRequests, Lower(Author.Email) = k); RemoveIf(AvenueSupportMessages, Lower(Author.Email) = k); '
    'RemoveIf(AvenueDocumentSubmissions, Lower(Author.Email) = k || Lower(OnBehalfOf) = k); RemoveIf(AvenueMembers, MemberId = k); Reset(maWipeConfirm); Refresh(AvenueMembers); '
    'Notify("Member and data deleted for good (the Power Apps delete skips the recycle bin). Remove the Entra guest separately if you no longer need it.", NotificationType.Success), '
    'Notify("Some rows could not be removed (a list may not be connected or you lack permission). Check and press Refresh.", NotificationType.Error)))',
    DisplayMode='If(!IsBlank(' + MA_SEL + ') && Lower(Trim(maWipeConfirm.Text)) = ' + _WK + ', DisplayMode.Edit, DisplayMode.Disabled)', Fill=BAD, Color=SURFACE, Visible=MV['profile'] + ' && ' + CANM))

# ----- Hours ledger: read only; a wrong row is corrected by a counter-adjustment, never edited or deleted -----
_VIS = MV['ledger']
parts.append(label('maLgSum', 'If(IsBlank(' + MA_SEL + '), "", With({p: ' + EPERIOD + '}, "This month (" & p & "): " & Text(Coalesce(Sum(Filter(AvenueHoursLedger, MemberId = ' + MA_SEL + '.MemberId, Period = p), Hours), 0)) & " h used (ledger)"))', 690, 184, 640, 28, Size=12, FontWeight='FontWeight.Bold', Color=OLIVE))
parts.append(gallery('maLgGal', 'If(IsBlank(' + MA_SEL + '), Blank(), SortByColumns(Filter(AvenueHoursLedger, MemberId = ' + MA_SEL + '.MemberId), "Created", SortOrder.Descending))', 690, 216, 640, 300, 52, [
    child('maLgLine', 'ThisItem.Period & " · " & Coalesce(ThisItem.Reason.Value, "-") & " · " & Text(ThisItem.Hours) & " h" & If(IsBlank(ThisItem.BookingId), "", " · " & ThisItem.BookingId)', 8, 2, 600, 24, Size=12),
    child('maLgNote', 'Coalesce(ThisItem.Note, "") & " · " & ThisItem.EntryId', 8, 26, 600, 22, Size=10, Color=SUBTLE)]))
parts.append(ctl('maLgWhy', 'Classic/TextInput', {'Default': '""', 'HintText': '"Reason for the counter-adjustment (required)"', 'X': 690, 'Y': 526, 'Width': 440, 'Height': 36}))
parts.append(button('maLgReverse', 'Counter-adjust selected', 1140, 526, 190, 36,
    'With({r: maLgGal.Selected, id: "adj-" & Text(GUID())}, IfError(Patch(AvenueHoursLedger, Defaults(AvenueHoursLedger), {Title: "Adjustment", FacilityId: ' + FAC + ', EntryId: id, ChargeKey: id, MemberId: r.MemberId, BookingId: "", Period: r.Period, Hours: -r.Hours, '
    'Reason: {Value: "Adjustment"}, Note: "Reverses " & r.EntryId & ": " & Trim(maLgWhy.Text) & " (by " & User().Email & ")"}); Reset(maLgWhy); Notify("Counter-adjustment recorded in the same month.", NotificationType.Success), Notify("Could not record it.", NotificationType.Error)))',
    DisplayMode='If(IsBlank(maLgGal.Selected) || IsBlank(Trim(maLgWhy.Text)) || Coalesce(maLgGal.Selected.Hours, 0) = 0, DisplayMode.Disabled, DisplayMode.Edit)', Visible=MV['ledger'] + ' && ' + CANM))
parts.append(hint('maLgHelp', '"Select a row, give a reason and press Counter-adjust: a new Adjustment row with the opposite hours is added to the same month. Rows are never edited or deleted. Other adjustments: Setup > Plans, documents, hours."', 690, 570, 640, 40))

# ----- Documents: verify / unverify registered documents; upload on the member's behalf -----
_VIS = MV['docs']
parts.append(gallery('maDocGal', 'If(IsBlank(' + MA_SEL + '), Blank(), SortByColumns(Filter(AvenueMemberDocuments, MemberId = ' + MA_SEL + '.MemberId), "ExpiryDate", SortOrder.Descending))', 690, 184, 640, 220, 56, [
    child('maDocLine', 'ThisItem.DocType.Value & " · " & Text(ThisItem.IssueDate, "d mmm yyyy") & " – " & Text(ThisItem.ExpiryDate, "d mmm yyyy")', 8, 2, 500, 24, Size=12, FontWeight='FontWeight.Semibold'),
    child('maDocMeta', 'Coalesce(ThisItem.DocStatus.Value, "-") & " · " & If(ThisItem.Verified, "verified", "not verified") & If(IsBlank(ThisItem.SupersededBy), "", " · superseded") & " · by " & Coalesce(ThisItem.UploadedBy, "-")', 8, 28, 500, 22, Size=10, Color=SUBTLE),
    ('maDocVerify', 'Classic/Button', {'Text': 'If(ThisItem.Verified, "Unverify", "Verify")', 'X': 516, 'Y': 10, 'Width': 104, 'Height': 34, 'Size': 11, **_RAD, 'Visible': CAND,
        'OnSelect': 'IfError(Patch(AvenueMemberDocuments, LookUp(AvenueMemberDocuments, ID = ThisItem.ID), {Verified: !ThisItem.Verified}); Notify(If(ThisItem.Verified, "Marked not verified.", "Verified."), NotificationType.Success), Notify("Could not save.", NotificationType.Error))'})]))
# Upload on behalf, the same three steps as the portal: 1) create the submission with Outcome "Uploading" (the document flow ignores it),
# 2) attach the file(s) through the edit form, 3) clear Outcome in OnSuccess, which starts the flow with the file present.
# The flow accepts OnBehalfOf only from staff (IsStaff) and records the member from it. Attachments: images and PDF, at most 5 x 10 MB (set on the card).
parts.append(head('maUpHead', '"Upload a document for this member"', 690, 414, 640, 14))
parts.append(ctl('maDocType', 'Classic/DropDown', {'Items': DOC_TYPES, 'X': 690, 'Y': 442, 'Width': 250, 'Height': 36}))
parts.append(ctl('maIssue', 'Classic/DatePicker', {'DefaultDate': 'Blank()', 'InputTextPlaceholder': '"Issue date"', 'X': 950, 'Y': 442, 'Width': 180, 'Height': 36}))
parts.append(ctl('maExpiry', 'Classic/DatePicker', {'DefaultDate': 'Blank()', 'InputTextPlaceholder': '"Expiry date"', 'X': 1140, 'Y': 442, 'Width': 190, 'Height': 36}))
MA_DOC_OK = '!IsBlank(' + MA_SEL + ') && !IsBlank(maDocType.Selected.Value) && !IsBlank(maExpiry.SelectedDate) && (IsBlank(maIssue.SelectedDate) || maExpiry.SelectedDate > maIssue.SelectedDate)'
parts.append(button('maDocStart', '1. Start upload', 690, 488, 200, 38,
    'With({sid: "staff-doc-" & Text(GUID())}, IfError(Set(varMaDoc, Patch(AvenueDocumentSubmissions, Defaults(AvenueDocumentSubmissions), {Title: sid, FacilityId: ' + FAC + ', SubmissionId: sid, DocType: {Value: maDocType.Selected.Value}, '
    'IssueDate: maIssue.SelectedDate, ExpiryDate: maExpiry.SelectedDate, OnBehalfOf: ' + MA_SEL + '.MemberId, Outcome: "Uploading"})); EditForm(maDocForm); Notify("Now attach the file(s) below and press 2. Upload and send.", NotificationType.Information), '
    'Notify("Could not start the upload.", NotificationType.Error)))',
    DisplayMode='If(' + MA_DOC_OK + ' && IsBlank(varMaDoc), DisplayMode.Edit, DisplayMode.Disabled)', Visible=MV['docs'] + ' && ' + CAND))
# maDocForm is NOT generated: Studio rejects pasted Form@2.4.4 (PA1011 'Layout' missing). Insert an Edit form named maDocForm by hand (docs/STAFF_CRUD_GUIDE.md step 6) with these properties:
#   parts.append(ctl('maDocForm', 'Form@2.4.4', {'DataSource': 'AvenueDocumentSubmissions', 'Item': 'varMaDoc', 'DefaultMode': 'FormMode.Edit', 'X': 690, 'Y': 534, 'Width': 640, 'Height': 130,
#       'OnSuccess': 'IfError(Patch(AvenueDocumentSubmissions, LookUp(AvenueDocumentSubmissions, SubmissionId = varMaDoc.SubmissionId), {Outcome: Blank()}); Set(varMaLastDoc, varMaDoc.SubmissionId); Set(varMaDoc, Blank()); Reset(maIssue); Reset(maExpiry); '
#                    'Notify("Sent. The document flow registers it for the member (not verified yet).", NotificationType.Success), Notify("The file is attached but the submission was not released: press 2. Upload and send again.", NotificationType.Error))',
#       'OnFailure': 'Notify("Could not attach the file. Check the type (image or PDF) and size (10 MB each, 5 at most).", NotificationType.Error)',
#       'Visible': MV['docs'] + ' && !IsBlank(varMaDoc)'}))
parts.append(button('maDocSend', '2. Upload and send', 690, 672, 200, 38, 'SubmitForm(maDocForm)', Visible=MV['docs'] + ' && !IsBlank(varMaDoc)'))
parts.append(button2('maDocCancel', 'Cancel upload', 900, 672, 160, 38,
    'IfError(Patch(AvenueDocumentSubmissions, LookUp(AvenueDocumentSubmissions, SubmissionId = varMaDoc.SubmissionId), {Outcome: "Cancelled by staff"}); Set(varMaDoc, Blank()); ResetForm(maDocForm), Notify("Could not cancel.", NotificationType.Error))',
    Visible=MV['docs'] + ' && !IsBlank(varMaDoc)'))
parts.append(label('maDocOut', 'If(IsBlank(varMaLastDoc), "", "Last upload: " & Coalesce(LookUp(AvenueDocumentSubmissions, SubmissionId = varMaLastDoc).Outcome, "waiting for the document flow... (Refresh)"))', 690, 716, 640, 40, Size=11, Color=SUBTLE))

# ----- Team: read only. The roster is the member's own-items list; UNKNOWN whether staff accounts can read those items. -----
_VIS = MV['team']
parts.append(gallery('maTeamGal', 'If(IsBlank(' + MA_SEL + '), Blank(), Filter(AvenueTeamMembers, Lower(Author.Email) = Lower(' + MA_SEL + '.MemberId)))', 690, 184, 640, 360, 44, [
    child('maTeamLine', 'ThisItem.PersonName & " · " & Coalesce(ThisItem.Role.Value, "-") & If(ThisItem.Active = false, " · inactive", "")', 8, 6, 600, 30, Size=12)]))
parts.append(hint('maTeamNone', '"No team rows visible. Either the member has not added a team, or staff accounts cannot read members\' own-items lists (UNKNOWN until tested). Read only."', 690, 554, 640, 40,
                  Visible=MV['team'] + ' && CountRows(maTeamGal.AllItems) = 0'))
_DY, _VIS = 0, None
write('memberadmin.pa.yaml', parts)
_DY = 0

print('ok')
