const fs = require('fs');
let content = fs.readFileSync('src/pages/portals/PropertyManagerPortal.tsx', 'utf8');

if (!content.includes('import FinancialOverviewChart')) {
  content = content.replace(
    "import ActivityFeedWidget from '../../components/ActivityFeedWidget';",
    "import ActivityFeedWidget from '../../components/ActivityFeedWidget';\nimport FinancialOverviewChart from '../../components/FinancialOverviewChart';\nimport LeaseExpirationsWidget from '../../components/LeaseExpirationsWidget';"
  );
}

const target = `<div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PendingRentWidget />
        <ActivityFeedWidget />
      </div>`;

const replacement = `<div className="mt-6 grid gap-6 lg:grid-cols-2">
        <FinancialOverviewChart />
        <LeaseExpirationsWidget />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PendingRentWidget />
        <ActivityFeedWidget />
      </div>`;

if(content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/pages/portals/PropertyManagerPortal.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
