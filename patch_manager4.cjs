const fs = require('fs');
let content = fs.readFileSync('src/pages/portals/PropertyManagerPortal.tsx', 'utf8');

if (!content.includes('import TenantScreening')) {
  content = content.replace(
    "import DocumentCenter from '../../components/DocumentCenter';",
    "import DocumentCenter from '../../components/DocumentCenter';\nimport TenantScreening from '../../components/TenantScreening';"
  );
}

const target = `<div className="mt-6 grid gap-6 lg:grid-cols-2">
        <FinancialOverviewChart />
        <LeaseExpirationsWidget />
      </div>`;

const replacement = `<div className="mt-6 grid gap-6 lg:grid-cols-2">
        <FinancialOverviewChart />
        <div className="flex flex-col gap-6">
          <div className="flex-1"><LeaseExpirationsWidget /></div>
          <div className="flex-1"><TenantScreening /></div>
        </div>
      </div>`;

if(content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/pages/portals/PropertyManagerPortal.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
