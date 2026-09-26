const fs = require('fs');
let content = fs.readFileSync('src/pages/portals/AdminPortal.tsx', 'utf8');

if (!content.includes('import AdminAuditLog')) {
  content = content.replace(
    "import { ShieldAlert, Users, Settings, Database, Activity } from 'lucide-react';",
    "import { ShieldAlert, Users, Settings, Database, Activity } from 'lucide-react';\nimport AdminAuditLog from '../../components/AdminAuditLog';"
  );
}

const target = `            </div>
          </div>
        </div>
      </div>
    );`;

const replacement = `            </div>
          </div>
        </div>

        <div className="mt-8 h-[600px]">
          <AdminAuditLog />
        </div>
      </div>
    );`;

if(content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/pages/portals/AdminPortal.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
