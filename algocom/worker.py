"""Single-job stdin/stdout JSON adapter; no database or network calls."""
import json,sys,time
from engine import solve
start=time.perf_counter()
try:
    data=sys.stdin.buffer.read(2*1024*1024+1)
    if len(data)>2*1024*1024:raise ValueError('Payload exceeds 2 MiB')
    result=solve(json.loads(data))
except (ValueError,UnicodeError):
    result={'status':'ERROR','error_type':'INVALID_INPUT','message':'Invalid JSON or oversized payload'}
result['metrics']={'worker_elapsed_ms':round((time.perf_counter()-start)*1000,4)}
print(json.dumps(result,allow_nan=False))
