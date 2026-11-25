#!/usr/bin/env python3
"""
Staff-app YAML checker for Avenue Phase 1 PowerApps canvas screens.
Uses Python standard library only (no PyYAML, Python 3.9 compatible).
"""

import sys
import os
import glob
import re
import argparse

ALLOWED_CONTROL_TYPES = {
    "Label",
    "Classic/Button",
    "Classic/TextInput",
    "Classic/DropDown",
    "Classic/DatePicker",
    "Classic/Toggle",
    "ListBox",
    "Image",
    "Timer",
    "Gallery@2.15.0",
    "GroupContainer@1.3.0",
    "Form@2.4.4"   # edit form for attachments (Member admin > Documents); its Attachments card is added in Studio
}

EXPECTED_NAV_BUTTONS = [
    "Dashboard",
    "Requests",
    "Approved",
    "Schedule",
    "Book",
    "Members",
    "Compliance",
    "Check-ins",
    "Notices",
    "Checklist",
    "Settings",
    "More"
]

ALLOWED_DATA_SOURCES = {
    "AvenueBookings",
    "AvenueBookingRequests",
    "AvenueCalendar",
    "AvenueCheckIns",
    "AvenueChecklistQuestions",
    "AvenueComplianceOverrides", "AvenueComplianceCases",
    "AvenueEquipment",
    "AvenueFacilities",
    "AvenueHoursLedger",
    "AvenueMemberDocuments",
    "AvenueDocumentFiles",
    "AvenueMembers",
    "AvenueNoticeDrafts",
    "AvenueNotices",
    "AvenuePlans",
    "AvenueRequiredDocTypes",
    "AvenueApplicants", "AvenueInvoices", "AvenueHostRequests",
    "AvenueSensors", "AvenueSensorLatest", "AvenueSensorHourly", "AvenueTempExcursions",
    "AvenueSupportCases", "AvenueEventCases", "AvenueStorageCases", "AvenueStaffCapabilities",
    "AvenueSupportCategories", "AvenueSupportFiles", "AvenueSupportMessages", "AvenueDocumentSubmissions", "AvenueDiningTables", "AvenueTeamMembers"
}

ALLOWED_NAV_TARGETS = {f"Screen{i}" for i in range(1, 24)}
SKIP_NAV_FILES = {"approved-extensions.pa.yaml"}

ALLOWED_POWER_FX_FUNCTIONS = {
    "AddColumns", "Blank", "Char", "ClearCollect", "Coalesce", "Collect", "Sequence", "Min", "Max", "FirstN", "EncodeUrl",
    "Concat", "CountRows", "Date", "DateAdd", "DateDiff", "DateValue",
    "Day", "Defaults", "Filter", "First", "ForAll", "GUID", "GroupBy", "If", "IfError",
    "IsBlank", "IsMatch", "IsNumeric", "Launch", "Left", "Len", "LookUp",
    "Lower", "Mod", "Month", "Navigate", "Notify", "Now", "ParseJSON", "Patch",
    "RGBA", "Refresh", "Remove", "RemoveIf", "Reset", "Right", "Round", "RoundDown",
    "Set", "Sort", "SortByColumns", "Split", "StartsWith", "Substitute", "Switch", "Sum",
    "Table", "Text", "TimeZoneOffset", "Today", "Trim", "UpdateIf",
    "Upper", "Find", "User", "Value", "Weekday", "With", "Year", "SubmitForm", "EditForm", "ResetForm"
}

REQUIRED_SCREEN_NAMES = [
    "dashboard", "book", "members", "compliance", "checkins",
    "notices", "schedule", "checklist", "settings", "setup", "more",
    "payments", "sensors", "support", "applicants", "permissions", "reports"
]

DEMO_SCREENS = set()

UNKNOWN_QUESTION_MAP = {
    "permissions.pa.yaml": "Q-15"
}


from release import files_on, primary_nav, screens_on


def check_screens(screens_dir):
    errors = []
    files = sorted(glob.glob(os.path.join(screens_dir, "*.pa.yaml")))
    if not files:
        print(f"Error: No .pa.yaml files found in {screens_dir}", file=sys.stderr)
        return False

    # Check required screen files exist
    found_filenames = {os.path.basename(f) for f in files}
    for req_name in sorted(files_on() - {'approved-extensions'}):
        req_file = f"{req_name}.pa.yaml"
        if req_file not in found_filenames:
            errors.append(f"Required screen file '{req_file}' is missing from {screens_dir}")

    control_locations = {}  # control_name -> list of (filename, line_num)
    total_controls = 0

    for filepath in files:
        filename = os.path.basename(filepath)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            lines = content.splitlines()

        # 1. Parse controls and their types
        # Regex to locate controls: '- <name>:' followed by properties/control
        # Handles both top-level and children controls
        in_file_controls = []
        for i, line in enumerate(lines, start=1):
            match_ctrl = re.match(r"^\s*-\s*([A-Za-z0-9_]+):", line)
            if match_ctrl:
                ctrl_name = match_ctrl.group(1)
                # Look ahead for Control: <type>
                ctrl_type = None
                for j in range(i, min(i + 6, len(lines) + 1)):
                    match_type = re.match(r"^\s*Control:\s*([^\s]+)", lines[j - 1])
                    if match_type:
                        ctrl_type = match_type.group(1)
                        break

                if ctrl_type:
                    total_controls += 1
                    in_file_controls.append((ctrl_name, ctrl_type, i))
                    if ctrl_name not in control_locations:
                        control_locations[ctrl_name] = []
                    control_locations[ctrl_name].append((filename, i))

                    # Check control type validity
                    if ctrl_type not in ALLOWED_CONTROL_TYPES:
                        errors.append(
                            f"[{filename}:{i}] Invalid control type '{ctrl_type}' for control '{ctrl_name}'"
                        )

        # 2. Check navigation row on generated screens
        if filename not in SKIP_NAV_FILES:
            nav_buttons = []
            # Extract buttons belonging to the nav row (named *Nav* and of type Classic/Button)
            # Find in control blocks
            for ctrl_name, ctrl_type, line_num in in_file_controls:
                if ctrl_type == "Classic/Button" and "Nav" in ctrl_name:
                    # Find Text property for this control
                    for k in range(line_num, min(line_num + 15, len(lines) + 1)):
                        match_text = re.match(r"^\s*Text:\s*=?\"([^\"]*)\"", lines[k - 1])
                        if match_text:
                            nav_buttons.append(match_text.group(1))
                            break

            expected_nav = [g for g, _ in primary_nav()]
            if nav_buttons != expected_nav or len(nav_buttons) > 6:
                errors.append(
                    f"[{filename}] Navigation row mismatch (at most 6 primary destinations).\n"
                    f"  Expected: {expected_nav}\n"
                    f"  Found:    {nav_buttons}"
                )

        # 3. Check Navigate(ScreenN) targets
        nav_targets = re.findall(r"Navigate\s*\(\s*([^,\s)]+)", content)
        for target in nav_targets:
            clean_target = target.strip("'\"")
            if clean_target in ALLOWED_NAV_TARGETS and clean_target not in screens_on():
                errors.append(f"[{filename}] Navigate({clean_target}) points to a screen that is not in this release.")
            if clean_target not in ALLOWED_NAV_TARGETS:
                errors.append(
                    f"[{filename}] Invalid Navigate target '{clean_target}'. Must be Screen1..Screen23."
                )

        # 4. Check Avenue<Something> data sources
        avenue_identifiers = set(re.findall(r"\b(Avenue[A-Za-z0-9_]+)\b", content))
        for ident in avenue_identifiers:
            if ident not in ALLOWED_DATA_SOURCES:
                errors.append(
                    f"[{filename}] Unauthorized Avenue data source '{ident}' used."
                )

        # 5. Check Power Fx function calls in formulas
        for line_idx, line in enumerate(lines, start=1):
            if (re.match(r"^\s*Control:", line) or
                re.match(r"^\s*-\s*[A-Za-z0-9_]+:", line) or
                re.match(r"^\s*(Properties|Children):", line)):
                continue
            stripped = re.sub(r'"(?:[^"]|"")*"', '""', line)
            matches = re.findall(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*\(", stripped)
            for fn in matches:
                if fn not in ALLOWED_POWER_FX_FUNCTIONS:
                    errors.append(
                        f"[{filename}:{line_idx}] Disallowed or unknown Power Fx function '{fn}' in formula: {line.strip()}"
                    )

        # 6. Check demo screens contain the word 'DEMO' in at least one Label
        if filename in DEMO_SCREENS:
            has_demo_label = False
            for ctrl_name, ctrl_type, line_num in in_file_controls:
                if ctrl_type == "Label":
                    for k in range(line_num, min(line_num + 15, len(lines) + 1)):
                        match_text = re.match(r"^\s*Text:\s*=?\"([^\"]*)\"", lines[k - 1])
                        if match_text and "DEMO" in match_text.group(1):
                            has_demo_label = True
                            break
                    if has_demo_label:
                        break
            if not has_demo_label:
                errors.append(
                    f"[{filename}] Demo screen must contain the word 'DEMO' in at least one Label."
                )

        # 7. Check screens with UNKNOWN questions mention the relevant question id
        if filename in UNKNOWN_QUESTION_MAP:
            qid = UNKNOWN_QUESTION_MAP[filename]
            if qid not in content:
                errors.append(
                    f"[{filename}] Screen must mention required question id '{qid}'."
                )

    # 8. Check duplicate control names across screens
    for ctrl_name, occurrences in control_locations.items():
        if len(occurrences) > 1:
            locs = ", ".join(f"{fn}:{ln}" for fn, ln in occurrences)
            errors.append(
                f"Duplicate control name '{ctrl_name}' found across screens: {locs}"
            )

    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        return False

    print(f"OK: {total_controls} controls in {len(files)} files")
    return True


def main():
    parser = argparse.ArgumentParser(description="Check PowerApps YAML screen files")
    parser.add_argument("--dir", default=None, help="Directory containing .pa.yaml files")
    args = parser.parse_args()

    if args.dir:
        screens_dir = args.dir
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        screens_dir = os.path.join(script_dir, "screens")

    success = check_screens(screens_dir)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
