const fs = require('fs');
let content = fs.readFileSync('src/pages/portals/TenantPortal.tsx', 'utf8');

if (!content.includes('import CommunityBoard')) {
  content = content.replace(
    "import PaymentHistoryChart from '../../components/PaymentHistoryChart';",
    "import PaymentHistoryChart from '../../components/PaymentHistoryChart';\nimport CommunityBoard from '../../components/CommunityBoard';"
  );
}

const target = `<PaymentHistoryChart />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">`;

const replacement = `<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaymentHistoryChart />
        <CommunityBoard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">`;

if(content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/pages/portals/TenantPortal.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
