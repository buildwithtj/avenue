#!/usr/bin/env bash
# Puts the host's secrets into /etc/avenue/host.env on the AWS server WITHOUT echoing them.
# Run it yourself in a terminal (values are typed or pasted at hidden prompts; press Enter to skip one you do not have yet).
# Usage: KEY=./avenue.pem HOST=13.207.228.174 scripts/set-host-secrets.sh [NAME ...]   (no names = ask for all)
# Nothing is written to this computer's disk; values travel over ssh stdin, never as command arguments.
set -euo pipefail
: "${KEY:?set KEY to the ssh private key path}"; : "${HOST:?set HOST}"
names=(STRIPE_SECRET_KEY SP_BRIDGE_APPLICANTS SP_BRIDGE_MEMBERS SP_BRIDGE_INVOICES SP_BRIDGE_LEDGER SP_BRIDGE_GRANT SWIFT_API_KEY SWIFT_USER SWIFT_PASSWORD SP_BRIDGE_SENSORS SP_BRIDGE_SENSOR_LATEST SP_BRIDGE_SENSOR_HOURLY SP_BRIDGE_EXCURSIONS)
# Optional: list only the names you want to be asked for, e.g.  scripts/set-host-secrets.sh SWIFT_API_KEY SWIFT_USER
[ "$#" -gt 0 ] && names=("$@")
json="{"; sep=""
for n in "${names[@]}"; do
  read -rsp "$n (Enter to skip): " v; echo
  [ -n "$v" ] || continue
  json+="$sep\"$n\": $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$v")"; sep=","
done
json+="}"
printf '%s' "$json" | ssh -i "$KEY" -o BatchMode=yes ubuntu@"$HOST" 'sudo python3 -c "
import json,os,re,secrets,sys
p=\"/etc/avenue/host.env\"; new=json.load(sys.stdin)
if new.get(\"STRIPE_SECRET_KEY\") and not re.fullmatch(r\"(sk|rk)_test_[A-Za-z0-9]+\", new[\"STRIPE_SECRET_KEY\"]): sys.exit(\"refused: only a Stripe TEST key is accepted\")
lines=open(p).read().splitlines(); cur={l.split(\"=\",1)[0]:i for i,l in enumerate(lines) if \"=\" in l}
defaults={\"STRIPE_ACCOUNT\":\"acct_1UYbYzAsg6Xog0k8\",\"PORTAL_URL\":\"https://bstreethq.sharepoint.com/sites/Avenue/SitePages/Member-portal.aspx\",\"PUBLIC_BASE_URL\":\"https://13-207-228-174.sslip.io\",\"JOIN_PUBLIC\":\"1\",\"APPLICATION_DAYS\":\"14\"}
for k,v in defaults.items():
    if not (k in cur and lines[cur[k]].split(\"=\",1)[1]): new.setdefault(k,v)
if not (\"BRIDGE_KEY\" in cur and lines[cur[\"BRIDGE_KEY\"]].split(\"=\",1)[1]): new[\"BRIDGE_KEY\"]=secrets.token_urlsafe(32)
for k,v in new.items():
    line=k+\"=\"+v
    if k in cur: lines[cur[k]]=line
    else: lines.append(line)
open(p,\"w\").write(\"\\n\".join(lines)+\"\\n\"); os.chmod(p,0o600)
print(\"updated:\",\", \".join(sorted(k for k in new if k!=\"BRIDGE_KEY\")), \"(BRIDGE_KEY set)\")
"'
echo "Done. Nothing was restarted; I will deploy and restart the host next."
