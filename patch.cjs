const fs = require('fs');
let content = fs.readFileSync('src/pages/portals/TenantPortal.tsx', 'utf8');

const replacement = `      )}

      {/* Floating Chatbot Widget */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        {isChatbotOpen && (
          <div className="mb-4 w-[350px] sm:w-[400px]">
            <TenantChatbot onClose={() => setIsChatbotOpen(false)} />
          </div>
        )}
        {!isChatbotOpen && (
          <button
            onClick={() => setIsChatbotOpen(true)}
            className="bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition-colors flex items-center justify-center"
          >
            <MessageSquare className="w-6 h-6" />
          </button>
        )}
      </div>

    </div>
  );
}`;
content = content.replace(/      \)}\n    <\/div>\n  \);\n}/, replacement);
fs.writeFileSync('src/pages/portals/TenantPortal.tsx', content);
