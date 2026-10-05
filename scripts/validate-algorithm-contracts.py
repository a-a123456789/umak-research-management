"""Structural schema checks; semantic constraints remain in engine.py."""
import json,subprocess,sys
from pathlib import Path
from jsonschema import Draft202012Validator
p=Path(__file__).resolve().parents[1]
request=json.loads((p/'algocom/schemas/request.schema.json').read_text());response=json.loads((p/'algocom/schemas/response.schema.json').read_text())
for schema in [request,response]:Draft202012Validator.check_schema(schema)
v=Draft202012Validator(response);sample=json.loads((p/'algocom/example.json').read_text());Draft202012Validator(request).validate(sample)
for payload in [sample,{**sample,'completed_actions':sample['steps']},{}]:
 r=subprocess.run([sys.executable,str(p/'algocom/worker.py')],input=json.dumps(payload),capture_output=True,text=True,check=True)
 v.validate(json.loads(r.stdout))
assert not v.is_valid({'status':'SUCCESS'})
assert not Draft202012Validator(request).is_valid({**sample,'extra':True})
print('Draft 2020-12 request and SUCCESS/COMPLETE/ERROR result contracts verified.')
