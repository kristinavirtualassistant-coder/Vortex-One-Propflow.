const fs = require('fs');
let content = fs.readFileSync('src/pages/portals/PropertyManagerPortal.tsx', 'utf8');

if (!content.includes('import DocumentCenter')) {
  content = content.replace(
    "import MessageCenter from '../../components/MessageCenter';",
    "import MessageCenter from '../../components/MessageCenter';\nimport DocumentCenter from '../../components/DocumentCenter';"
  );
}

const targetEnd = `      {activeTab === 'communications' && (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Communications</h2>
            <p className="text-slate-500 dark:text-slate-400">Message tenants, landlords, and vendors.</p>
          </div>
          <MessageCenter />
        </div>
      )}

    </div>
  );
}`;

const replacementEnd = `      {activeTab === 'communications' && (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Communications</h2>
            <p className="text-slate-500 dark:text-slate-400">Message tenants, landlords, and vendors.</p>
          </div>
          <MessageCenter />
        </div>
      )}

      {activeTab === 'documents' && (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Document Center</h2>
            <p className="text-slate-500 dark:text-slate-400">Manage leases, contracts, and compliance files.</p>
          </div>
          <DocumentCenter />
        </div>
      )}

    </div>
  );
}`;

if(content.includes(targetEnd)) {
    content = content.replace(targetEnd, replacementEnd);
    fs.writeFileSync('src/pages/portals/PropertyManagerPortal.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
