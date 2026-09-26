const fs = require('fs');
let content = fs.readFileSync('src/pages/portals/TenantPortal.tsx', 'utf8');

const target = `      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">`;
const replacement = `      <PaymentHistoryChart />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">`;

if(content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/pages/portals/TenantPortal.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
