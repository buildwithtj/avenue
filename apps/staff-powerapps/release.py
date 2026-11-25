import os, json
# Release control: only modules listed in ../../release/release.json are generated (missing file = all). Edit that file, not this one.
_REL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'release', 'release.json')
MODULES = set(json.load(open(_REL))['modules']) if os.path.exists(_REL) else None
def on(m): return m is None or MODULES is None or m in MODULES
SCREEN_MODULE = {'Requests': 'booking', 'Approved': 'booking', 'Schedule': 'booking', 'Book': 'booking', 'Setup': 'booking', 'Members': 'documents', 'Compliance': 'documents', 'Check-ins': 'checkin',
                 'Checklist': 'checkin', 'Notices': 'notices', 'Settings': 'billing', 'Insights': 'booking'}
HUB_MODULE = {'Screen11': 'booking', 'Screen13': 'payments', 'Screen14': 'sensors', 'Screen15': 'support', 'Screen16': 'applicants', 'Screen17': 'permissions', 'Screen18': 'reports', 'Screen21': 'events', 'Screen22': 'storage', 'Screen23': 'documents'}
FILE_MODULE = {'book': 'booking', 'requests': 'booking', 'approved': 'booking', 'approved-extensions': 'booking', 'schedule': 'booking', 'compliance': 'documents', 'members': 'documents', 'checkins': 'checkin',
               'checklist': 'checkin', 'notices': 'notices', 'settings': 'billing', 'setup': 'booking', 'reports': 'reports', 'insights': 'booking', 'payments': 'payments', 'sensors': 'sensors',
               'support': 'support', 'applicants': 'applicants', 'permissions': 'permissions', 'events': 'events', 'storage': 'storage', 'memberadmin': 'documents'}
HUB_ON = any(on(m) for m in HUB_MODULE.values())

SCREEN_ID = {'Dashboard': 'Screen3', 'Requests': 'Screen1', 'Approved': 'Screen2', 'Schedule': 'Screen19', 'Book': 'Screen9', 'Members': 'Screen8', 'Compliance': 'Screen4',
             'Check-ins': 'Screen5', 'Notices': 'Screen6', 'Checklist': 'Screen7', 'Settings': 'Screen10', 'Setup': 'Screen11', 'More': 'Screen12', 'Insights': 'Screen20'}
def nav_names():
    return [k for k in SCREEN_ID if on(SCREEN_MODULE.get(k)) and (k != 'More' or HUB_ON)]
def files_on():
    return {k for k in ['dashboard'] + list(FILE_MODULE) if on(FILE_MODULE.get(k)) } | ({'more'} if HUB_ON else set())
def screens_on():
    ids = {SCREEN_ID[k] for k in nav_names()}
    ids |= {s for s, m in HUB_MODULE.items() if on(m)} if HUB_ON else set()
    return ids

# Primary navigation: at most 6 destinations; a group with several screens gets a second row of tabs on its screens.
GROUPS = [('Dashboard', ['Dashboard', 'Insights']), ('Bookings', ['Requests', 'Approved', 'Schedule', 'Book']),
          ('Members', ['Members', 'Compliance', 'Check-ins', 'Checklist']), ('Notices', ['Notices']),
          ('Setup', ['Setup', 'Settings']), ('More', ['More'])]
def primary_nav():
    out = []
    for label, names in GROUPS:
        items = [(n, SCREEN_ID[n]) for n in names if on(SCREEN_MODULE.get(n)) and (n != 'More' or HUB_ON)]
        if items: out.append((label, items))
    return out
