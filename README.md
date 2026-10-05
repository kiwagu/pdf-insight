# PDF Insight

PDF Insight is a small web application that turns a PDF into a short, readable summary and a
validated structured JSON result. The PDF's text is extracted in the browser by a React
single-page app and sent to a serverless function (a Supabase Edge Function) that asks a large
language model for the analysis; the same schema validates the result on the server and in the
browser before anything is shown.

Work in progress.
