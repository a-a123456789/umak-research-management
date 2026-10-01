// INTENTIONALLY VULNERABLE: loaded only by scripts/demo-sqli.js in an isolated schema.
import express from 'express';
export function vulnerableApp(db) {
 const app=express();app.use(express.json());
 app.post('/api/v1/research/search',async(req,res)=>{
   const query="SELECT id,title,abstract,status FROM research_records WHERE status='Approved' AND title LIKE '%" + req.body.keyword + "%'";
   const r=await db.query(query);res.json(r.rows);
 });
 return app;
}
