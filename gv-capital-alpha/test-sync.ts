import { syncEtoroPortfolio } from './lib/storage';
import { getPortfolio } from './lib/storage';

async function main() {
  console.log('Starting sync...');
  try {
    const portfolio = await getPortfolio();
    console.log('Initial portfolio positions:', portfolio.positions.length);
    
    await syncEtoroPortfolio();
    
    console.log('Sync finished.');
    const updated = await getPortfolio();
    console.log('Updated portfolio positions:', updated.positions.length);
  } catch (err) {
    console.error('SYNC ERROR:', err);
  }
}

main();
