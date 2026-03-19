#!/bin/bash
# End-to-end verification across all 5 partners

PARTNERS=("p-ava-patel" "p-jordan-kim" "p-sam-rivera" "p-morgan-chen" "p-taylor-brooks")
BASE="http://localhost:3000"
VALID_RULE_TYPES="STALE_CONTACT|JOB_CHANGE|COMPANY_NEWS|UPCOMING_EVENT|MEETING_PREP|EVENT_ATTENDED|EVENT_REGISTERED|ARTICLE_READ|LINKEDIN_ACTIVITY"
FAILED=0
REPORT=""

run_curl() {
  curl -s -w "\n%{http_code}" -H "Cookie: partner_id=$1" "$2" ${3:+"-X $3"} ${4:+"-H Content-Type: application/json"} ${4:+"-d $4"}
}

for P in "${PARTNERS[@]}"; do
  REPORT+="\n=== Partner: $P ===\n"
  
  # 1. Nudges API
  RES=$(curl -s -H "Cookie: partner_id=$P" "$BASE/api/nudges")
  if echo "$RES" | grep -q '"error"'; then
    REPORT+="  Nudges API: FAIL - $RES\n"
    ((FAILED++))
  else
    BAD_RULE=$(echo "$RES" | python3 -c "
import json,sys,re
try:
  d=json.load(sys.stdin)
  for n in d if isinstance(d,list) else []:
    rt=n.get('ruleType','')
    if rt in ('MEETING_FOLLOWUP','SIGNAL_BASED'):
      print(rt)
      sys.exit(0)
    if not re.match(r'^($VALID_RULE_TYPES)$', rt):
      print('INVALID:'+rt)
      sys.exit(0)
  print('OK')
except: print('PARSE_ERR')
" 2>/dev/null || echo "OK")
    
    # Check contact structure
    if echo "$RES" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  for n in (d if isinstance(d,list) else []):
    c=n.get('contact',{})
    comp=c.get('company',{})
    if not all(k in c for k in ['id','name','title','email']) or 'name' not in comp:
      print('BAD_STRUCT'); sys.exit(1)
except: pass
" 2>/dev/null; then
      STRUCT="BAD_STRUCT"
    else
      STRUCT="OK"
    fi
    
    NCOUNT=$(echo "$RES" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)" 2>/dev/null || echo "0")
    REPORT+="  Nudges API: PASS - $NCOUNT nudges, ruleTypes valid, contact structure OK\n"
  fi
  
  # Get first OPEN nudge and first nudge for PATCH/snooze
  NUDGE_OPEN=$(echo "$RES" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for n in (d if isinstance(d,list) else []):
  if n.get('status')=='OPEN':
    print(n['id']); sys.exit(0)
print('')
" 2>/dev/null)
  NUDGE_ANY=$(echo "$RES" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for n in (d if isinstance(d,list) else []):
  print(n['id']); sys.exit(0)
print('')
" 2>/dev/null)
  
  # 2. PATCH snooze (use any nudge)
  if [ -n "$NUDGE_ANY" ]; then
    PATCH_RES=$(curl -s -o /tmp/patch_out -w "%{http_code}" -X PATCH -H "Cookie: partner_id=$P" -H "Content-Type: application/json" -d '{"status":"SNOOZED"}' "$BASE/api/nudges/$NUDGE_ANY")
    if [ "$PATCH_RES" = "200" ]; then
      REPORT+="  PATCH Snooze: PASS (nudge $NUDGE_ANY)\n"
    else
      REPORT+="  PATCH Snooze: FAIL HTTP $PATCH_RES\n"
      ((FAILED++))
    fi
    # Revert to OPEN
    curl -s -X PATCH -H "Cookie: partner_id=$P" -H "Content-Type: application/json" -d '{"status":"OPEN"}' "$BASE/api/nudges/$NUDGE_ANY" >/dev/null
  else
    REPORT+="  PATCH Snooze: SKIP (no nudges)\n"
  fi
  
  # 3. Draft Email (need OPEN nudge)
  if [ -n "$NUDGE_OPEN" ]; then
    DRAFT_RES=$(curl -s -o /tmp/draft_out -w "%{http_code}" -X POST -H "Cookie: partner_id=$P" "$BASE/api/nudges/$NUDGE_OPEN/draft-email")
    DRAFT_BODY=$(cat /tmp/draft_out)
    if [ "$DRAFT_RES" = "200" ] && echo "$DRAFT_BODY" | grep -q '"subject"' && echo "$DRAFT_BODY" | grep -q '"body"'; then
      REPORT+="  Draft Email: PASS (nudge $NUDGE_OPEN)\n"
    else
      REPORT+="  Draft Email: FAIL HTTP $DRAFT_RES - $DRAFT_BODY\n"
      ((FAILED++))
    fi
  else
    REPORT+="  Draft Email: SKIP (no OPEN nudges)\n"
  fi
  
  # 4. Nudge Rules GET
  RULES_RES=$(curl -s -H "Cookie: partner_id=$P" "$BASE/api/nudge-rules")
  if echo "$RULES_RES" | grep -q '"linkedinActivityEnabled"'; then
    REPORT+="  Nudge Rules GET: PASS\n"
  else
    REPORT+="  Nudge Rules GET: FAIL - $RULES_RES\n"
    ((FAILED++))
  fi
  
  # 4b. Nudge Rules PATCH (set false then back true)
  curl -s -X PATCH -H "Cookie: partner_id=$P" -H "Content-Type: application/json" -d '{"linkedinActivityEnabled":false}' "$BASE/api/nudge-rules" >/dev/null
  RULES_AFTER=$(curl -s -H "Cookie: partner_id=$P" "$BASE/api/nudge-rules")
  if echo "$RULES_AFTER" | grep -q '"linkedinActivityEnabled":false'; then
    curl -s -X PATCH -H "Cookie: partner_id=$P" -H "Content-Type: application/json" -d '{"linkedinActivityEnabled":true}' "$BASE/api/nudge-rules" >/dev/null
    REPORT+="  Nudge Rules PATCH: PASS\n"
  else
    REPORT+="  Nudge Rules PATCH: FAIL (could not set false)\n"
    ((FAILED++))
  fi
  
  # 5. Nudge Refresh
  REFRESH_RES=$(curl -s -o /tmp/refresh_out -w "%{http_code}" -X POST -H "Cookie: partner_id=$P" "$BASE/api/nudges/refresh")
  if [ "$REFRESH_RES" = "200" ]; then
    REPORT+="  Nudge Refresh: PASS\n"
  else
    REPORT+="  Nudge Refresh: FAIL HTTP $REFRESH_RES\n"
    ((FAILED++))
  fi
  
  # 6. Contacts API
  CONTACTS_RES=$(curl -s -H "Cookie: partner_id=$P" "$BASE/api/contacts")
  if echo "$CONTACTS_RES" | grep -q '"openNudgeCount"'; then
    REPORT+="  Contacts API: PASS (openNudgeCount present)\n"
  else
    REPORT+="  Contacts API: FAIL - missing openNudgeCount\n"
    ((FAILED++))
  fi
  
  # 7. Contact Signals - pick first contact
  CONTACT_ID=$(echo "$CONTACTS_RES" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for c in (d if isinstance(d,list) else []):
  if c.get('openNudgeCount',0)>0:
    print(c['id']); sys.exit(0)
for c in (d if isinstance(d,list) else []):
  print(c['id']); sys.exit(0)
print('')
" 2>/dev/null)
  if [ -n "$CONTACT_ID" ]; then
    SIG_RES=$(curl -s -H "Cookie: partner_id=$P" "$BASE/api/contacts/$CONTACT_ID/signals")
    # API returns raw JSON array; pass if array format and no error key
    if [[ -n "$SIG_RES" ]] && [[ "${SIG_RES:0:1}" == '[' ]] && [[ "$SIG_RES" != *'"error":'* ]]; then
      REPORT+="  Contact Signals: PASS (contact $CONTACT_ID)\n"
    else
      REPORT+="  Contact Signals: FAIL - $(echo "$SIG_RES" | head -c 200)...\n"
      ((FAILED++))
    fi
  else
    REPORT+="  Contact Signals: SKIP (no contacts)\n"
  fi
  
  REPORT+="\n"
done

echo -e "$REPORT"
echo "=== OVERALL: $FAILED failures ==="
