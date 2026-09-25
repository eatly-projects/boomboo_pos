import 'dotenv/config';
import app from './app.js';

const PORT = Number(process.env.PORT || 4100);

app.listen(PORT, () => {
  console.log(`\n  Backend Boomboo siap.`);
  console.log(`  http://localhost:${PORT}/api/sehat\n`);
});
