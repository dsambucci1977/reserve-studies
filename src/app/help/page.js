'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const faqSections = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: '#1d398f',
    items: [
      {
        q: 'How do I create a new reserve study project?',
        a: 'From the Dashboard, click "Manage Projects" → then click the "+ New Site" button in the top right. Fill in the site name, project number, and address. Once created, you\'ll be taken to the site detail page where you can add project information and components.'
      },
      {
        q: 'What is the typical workflow for a reserve study?',
        a: 'The workflow follows four main steps:\n\n1. **Create a Site** — Enter the property details and project number\n2. **Set Project Info** — Configure financial parameters like beginning year, interest rate, inflation rate, cost adjustment factor, and beginning reserve balance\n3. **Add Components** — Import from CSV or add manually. Assign useful life, remaining useful life, and replacement costs\n4. **Run Calculations** — Generate the 30-year Master Replacement Schedule and Cash Flow projections, then generate your report'
      },
      {
        q: 'What do the different study statuses mean?',
        a: '**Draft** — Study is being set up, components may still be added or edited\n**Calculated** — Calculations have been run and results are available\n**Sent to Client** — The report has been delivered to the client\n**Completed** — Study is finalized and archived'
      },
    ]
  },
  {
    id: 'project-info',
    title: 'Project Information & Financial Parameters',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    color: '#3b82f6',
    items: [
      {
        q: 'What is the Beginning Year?',
        a: 'The beginning year (or fiscal year start) is the first year of the 30-year projection. Typically this is the current year or the year the study takes effect. All replacement timelines are calculated from this year.'
      },
      {
        q: 'What is the Cost Adjustment Factor (CAF)?',
        a: 'The CAF adjusts base component costs to account for regional pricing, contractor markups, or other local cost factors. For example, a CAF of 1.15 means costs are 15% above the base estimate. A CAF of 1.00 means no adjustment. This factor is applied to all component costs in the cash flow calculations.'
      },
      {
        q: 'How does the Inflation Rate work?',
        a: 'The inflation rate is applied annually to project future replacement costs. For example, if a roof costs $50,000 today and inflation is 3%, the projected cost in 10 years would be approximately $67,196. This ensures the reserve fund accounts for rising costs over the 30-year period.'
      },
      {
        q: 'What is the Beginning Reserve Balance?',
        a: 'This is the current amount already in the reserve fund at the start of the study. It serves as the starting point for all cash flow projections. A higher starting balance means less annual contribution may be needed.'
      },
      {
        q: 'What is the Interest Rate used for?',
        a: 'The interest rate represents the expected annual return on the reserve fund balance (e.g., from a money market or savings account). Interest earnings are added to the fund each year in the cash flow projections, reducing the required annual contributions.'
      },
      {
        q: 'Why do schedule costs differ from cash flow expenditures?',
        a: 'The Master Replacement Schedule shows base costs, while Cash Flow projections apply both the Cost Adjustment Factor (CAF) and cumulative inflation. For example, a $1,750 base cost with a CAF of 1.15 becomes $2,012 in the first year, and increases further each subsequent year due to inflation.'
      },
    ]
  },
  {
    id: 'components',
    title: 'Components & Import',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    color: '#22c55e',
    items: [
      {
        q: 'How do I add components to a site?',
        a: 'Navigate to your site → click "Components" → then either:\n\n• **Add Manually** — Click "+ New Component" and fill in the description, category, useful life, remaining useful life, quantity, unit cost, etc.\n• **Import from CSV** — Click "Import" and upload a CSV file with your component data. The importer will map your columns to the required fields.'
      },
      {
        q: 'What CSV format is required for import?',
        a: 'Your CSV should include columns for: Description (or Component Name), Category, Useful Life, Remaining Useful Life, Quantity, Unit Cost, and optionally Total Cost. The import wizard lets you map your column headers to the required fields, so exact column names don\'t matter.'
      },
      {
        q: 'What is Remaining Useful Life vs. Useful Life?',
        a: '**Useful Life** — The total expected lifespan of a component (e.g., a roof might have a 25-year useful life)\n\n**Remaining Useful Life (RUL)** — How many years are left before replacement is needed from the beginning year. If a roof is 10 years old with a 25-year useful life, the RUL is 15 years. The replacement year is calculated as: Beginning Year + RUL.'
      },
      {
        q: 'What is the difference between Reserve and PM components?',
        a: '**Reserve Components** — Major items funded through the reserve fund (roofs, HVAC, paving, etc.). These appear in the Master Replacement Schedule and Cash Flow analysis.\n\n**Preventive Maintenance (PM)** — Recurring maintenance items (painting touch-ups, filter replacements, etc.) that are typically funded through the operating budget, not reserves. PM items are tracked separately.'
      },
      {
        q: 'What are Component Notes?',
        a: 'Component Notes are a shared library of standardized descriptions and condition assessments. When creating or editing a component, you can assign a note from your library. This ensures consistent language and descriptions across all your reserve studies. Manage your notes library from the "Component Notes" section on the dashboard.'
      },
      {
        q: 'Can I edit components after running calculations?',
        a: 'Yes! You can always edit, add, or remove components. However, after making changes you\'ll need to re-run calculations for the results to reflect your updates. The previous calculation results will remain until you recalculate.'
      },
    ]
  },
  {
    id: 'calculations',
    title: 'Calculations & Results',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: '#8b5cf6',
    items: [
      {
        q: 'How do I run calculations?',
        a: 'Navigate to your site → click "Calculate". The system will generate the 30-year Master Replacement Schedule and two Cash Flow analyses:\n\n• **Current Funding (green)** — Based on the current annual contribution\n• **Full Funding (red)** — The recommended contribution to maintain a positive reserve balance throughout the 30-year period\n\nResults are saved and can be viewed anytime from the "Results" page.'
      },
      {
        q: 'What is the Master Replacement Schedule?',
        a: 'The Master Replacement Schedule is a 30-year table showing every component replacement event, organized by year. Each row shows the component description, its useful life, remaining useful life, and the projected replacement cost for that year. This schedule drives the Cash Flow analysis.'
      },
      {
        q: 'What is the difference between Current Funding and Full Funding?',
        a: '**Current Funding** — Projects the reserve fund forward using the association\'s current annual contribution amount. This often reveals a funding shortfall where the balance goes negative.\n\n**Full Funding** — Calculates the recommended annual contribution needed to keep the reserve balance positive throughout the entire 30-year period while covering all projected replacements. The gap between current and full funding is the key insight for your client.'
      },
      {
        q: 'Why do my results show negative balances?',
        a: 'A negative balance in the Current Funding scenario means the current contribution rate is insufficient to cover projected replacements. This is actually expected and is one of the most important findings in a reserve study — it demonstrates to the client why their contribution rate needs to increase. The Full Funding scenario shows what the contribution should be to avoid this shortfall.'
      },
      {
        q: 'How do I view charts and graphs?',
        a: 'Navigate to your site → click "Charts". You\'ll see visual representations of the 30-year projections including reserve balance trends, annual expenditures, and contribution comparisons between current and full funding scenarios.'
      },
    ]
  },
  {
    id: 'health-monitor',
    title: 'Component Health Monitor',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: '#ef4444',
    items: [
      {
        q: 'What is the Component Health Monitor?',
        a: 'The Health Monitor aggregates all components across every site and flags items nearing end of life. It helps you identify which properties have the most urgent replacement needs and how much financial exposure you have in the near term. Access it from the "Component Health" tile on the dashboard or "Health" in the navigation bar.'
      },
      {
        q: 'What do Critical, Warning, and Healthy mean?',
        a: 'Components are classified into urgency tiers based on years remaining before replacement:\n\n• **Critical (red)** — 2 years or less remaining (needs immediate attention)\n• **Warning (amber)** — 3–5 years remaining (plan ahead)\n• **Healthy (green)** — More than 5 years remaining\n\nYou can customize these thresholds using the "Thresholds" button on the Expiring Soonest view.'
      },
      {
        q: 'What are the three views?',
        a: '**Expiring Soonest** — A filterable table of all components sorted by urgency. Use the search bar and dropdown filters to find specific items by site, category, status, or type.\n\n**$ Exposure** — Shows total replacement cost exposure within 1, 3, 5, and 10 years, with a visual timeline bar chart.\n\n**Per-Site Health** — Cards for each property showing a health distribution bar. Click any card to drill down into that site\'s replacement timeline chart, health donut chart, category breakdown, and full component list.'
      },
      {
        q: 'Can I adjust the urgency thresholds?',
        a: 'Yes! On the "Expiring Soonest" view, click the "Thresholds" button in the filter bar. You can set custom year boundaries for Critical and Warning tiers. For example, you might set Critical to ≤1 year and Warning to ≤3 years for a more conservative approach, or widen them for a longer planning horizon.'
      },
    ]
  },
  {
    id: 'reports',
    title: 'Reports & Delivery',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: '#f59e0b',
    items: [
      {
        q: 'How do I generate a report?',
        a: 'Navigate to your site → click "Reports". You can generate a professional PDF report that includes the property information, component inventory, Master Replacement Schedule, Cash Flow projections, and funding recommendations. Make sure calculations have been run before generating the report.'
      },
      {
        q: 'How do I mark a study as sent to client?',
        a: 'On the site detail page, you can update the study status from the status dropdown. Change it to "Sent to Client" once you\'ve delivered the report. This helps you track which studies are in progress versus completed.'
      },
    ]
  },
  {
    id: 'admin',
    title: 'Administration',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: '#6b7280',
    items: [
      {
        q: 'How do I invite new users to my organization?',
        a: 'Go to Admin Settings (from the Organization card on the dashboard) → find the user invitation section. Enter the new user\'s email address and select their role. They\'ll receive an invitation to create their account and will automatically be linked to your organization.'
      },
      {
        q: 'What are the different user roles?',
        a: '**User** — Can view and work on sites assigned to them\n**Admin** — Full access to all sites plus organization settings (manage users, invitations, branding)\n**Super Admin** — System-level access for managing all organizations (Pronoia Solutions only)'
      },
      {
        q: 'How do I update my profile?',
        a: 'Click "Profile" in the navigation bar. You can update your display name, contact information, and other personal details. Click "Edit" to make changes, then "Save" when done.'
      },
    ]
  },
];

export default function HelpPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState({});
  const [activeSection, setActiveSection] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/auth/signin');
    }
  }, [user]);

  const toggleItem = (sectionId, idx) => {
    const key = `${sectionId}-${idx}`;
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const all = {};
    faqSections.forEach(section => {
      section.items.forEach((_, idx) => { all[`${section.id}-${idx}`] = true; });
    });
    setExpandedItems(all);
  };

  const collapseAll = () => setExpandedItems({});

  // Filter by search
  const filteredSections = searchTerm
    ? faqSections.map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.a.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })).filter(section => section.items.length > 0)
    : faqSections;

  const totalQuestions = faqSections.reduce((sum, s) => sum + s.items.length, 0);

  // Simple markdown-ish rendering for bold and line breaks
  const renderAnswer = (text) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j} className="text-gray-900">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      return (
        <span key={i}>
          {i > 0 && <br />}
          {parts}
        </span>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div style={{ backgroundColor: '#1d398f' }} className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v22H20v-1.5z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}></div>
        <div className="relative w-full px-6 py-8 pb-16">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="text-blue-200 hover:text-white text-sm transition-colors">← Back to Dashboard</Link>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Help & FAQ</h1>
                <p className="text-blue-200 text-sm mt-0.5">Everything you need to know about using Reserve Studies</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{faqSections.length}</div>
                <div className="text-[10px] text-blue-200 uppercase tracking-wide">Topics</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{totalQuestions}</div>
                <div className="text-[10px] text-blue-200 uppercase tracking-wide">Questions</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 -mt-8 relative z-10">

        {/* Search + Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[250px] relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search help topics..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button onClick={expandAll} className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">
              Expand All
            </button>
            <button onClick={collapseAll} className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">
              Collapse All
            </button>
          </div>
        </div>

        <div className="flex gap-5">

          {/* Sidebar - Topic Navigation */}
          <div className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Topics</p>
              </div>
              <div className="p-2">
                {faqSections.map(section => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      setActiveSection(section.id);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      activeSection === section.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: section.color }}></span>
                    {section.title}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-5 min-w-0">
            {filteredSections.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">No results found</p>
                <p className="text-xs text-gray-500 mt-1">Try a different search term</p>
              </div>
            ) : (
              filteredSections.map(section => (
                <div key={section.id} id={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden scroll-mt-4">
                  {/* Section Header */}
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: section.color }}>
                      {section.icon}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">{section.title}</h2>
                      <p className="text-[10px] text-gray-500">{section.items.length} question{section.items.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  {/* FAQ Items */}
                  <div>
                    {section.items.map((item, idx) => {
                      const key = `${section.id}-${idx}`;
                      const isOpen = expandedItems[key];
                      return (
                        <div key={idx} className="border-b border-gray-50 last:border-b-0">
                          <button
                            onClick={() => toggleItem(section.id, idx)}
                            className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
                          >
                            <span className="text-sm font-medium text-gray-900">{item.q}</span>
                            <svg
                              className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isOpen && (
                            <div className="px-5 pb-4 -mt-1">
                              <div className="text-sm text-gray-600 leading-relaxed pl-0 border-l-2 ml-0" style={{ borderColor: section.color, paddingLeft: '12px' }}>
                                {renderAnswer(item.a)}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

          </div>

          {/* Right Sidebar - Sticky Workflow */}
          <div className="hidden xl:block w-60 flex-shrink-0">
            <div className="sticky top-4 space-y-4">
              {/* Workflow Steps */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100" style={{ backgroundColor: '#1d398f' }}>
                  <h3 className="text-[11px] font-bold text-white flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Quick Reference
                  </h3>
                </div>
                <div className="p-3 space-y-3">
                  {[
                    { step: 1, title: 'Create Project', desc: 'Add a new site with property details', link: '/sites', linkLabel: 'Go to Projects', color: '#1d398f' },
                    { step: 2, title: 'Configure & Add', desc: 'Set financial parameters, import components', link: null, linkLabel: null, color: '#3b82f6' },
                    { step: 3, title: 'Calculate', desc: 'Generate 30-year projections', link: null, linkLabel: null, color: '#8b5cf6' },
                    { step: 4, title: 'Report & Monitor', desc: 'Deliver reports, track health', link: '/monitoring', linkLabel: 'Health Monitor', color: '#22c55e' },
                  ].map((item, i, arr) => (
                    <div key={item.step}>
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0" style={{ backgroundColor: item.color }}>
                            {item.step}
                          </div>
                          {i < arr.length - 1 && <div className="w-0.5 h-4 bg-gray-200 mt-1"></div>}
                        </div>
                        <div className="pt-0.5">
                          <h4 className="text-xs font-bold text-gray-900">{item.title}</h4>
                          <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">{item.desc}</p>
                          {item.link && (
                            <Link href={item.link} className="inline-block mt-1 text-[10px] font-semibold" style={{ color: item.color }}>
                              {item.linkLabel} →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Terms */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Key Terms
                  </h3>
                </div>
                <div className="p-3 space-y-2.5">
                  {[
                    { term: 'CAF', def: 'Cost Adjustment Factor — regional pricing multiplier' },
                    { term: 'RUL', def: 'Remaining Useful Life — years until replacement' },
                    { term: 'UL', def: 'Useful Life — total expected lifespan' },
                    { term: 'PM', def: 'Preventive Maintenance — operating budget items' },
                    { term: 'Full Funding', def: 'Recommended contribution to stay positive 30yr' },
                  ].map(item => (
                    <div key={item.term} className="flex gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 flex-shrink-0">{item.term}</span>
                      <span className="text-[10px] text-gray-500 leading-relaxed">{item.def}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Need More Help? */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4 text-center">
                <div className="w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1d398f' }}>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-[11px] font-bold text-gray-900">Need more help?</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Contact Pronoia Solutions for support</p>
                <a href="mailto:support@pronoia.solutions" className="inline-block mt-2 text-[10px] font-semibold" style={{ color: '#1d398f' }}>
                  support@pronoia.solutions
                </a>
              </div>
            </div>
          </div>
        </div>
            </div>
          </div>
        </div>

        <div className="py-8 text-center">
          <p className="text-[11px] text-gray-400">Help & FAQ — Pronoia Solutions</p>
        </div>
      </div>
    </div>
  );
}
