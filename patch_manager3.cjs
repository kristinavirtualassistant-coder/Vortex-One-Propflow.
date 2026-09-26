const fs = require('fs');
let content = fs.readFileSync('src/pages/portals/PropertyManagerPortal.tsx', 'utf8');

if (!content.includes('import MessageCenter')) {
  content = content.replace(
    "import FinancialOverviewChart from '../../components/FinancialOverviewChart';",
    "import FinancialOverviewChart from '../../components/FinancialOverviewChart';\nimport MessageCenter from '../../components/MessageCenter';"
  );
}

const target = `<div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Property Overview</h2>`;

const replacement = `<div className="space-y-8">
      {activeTab === 'dashboard' && (
        <>
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Property Overview</h2>`;

const targetEnd = `                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}`;

const replacementEnd = `                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {activeTab === 'communications' && (
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

if(content.includes(target) && content.includes(targetEnd)) {
    content = content.replace(target, replacement);
    content = content.replace(targetEnd, replacementEnd);
    fs.writeFileSync('src/pages/portals/PropertyManagerPortal.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
