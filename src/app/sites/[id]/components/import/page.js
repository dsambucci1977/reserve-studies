// src/app/sites/[id]/components/import/page.js
// CSV Import - with Download Sample and corrected instructions

'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { getSite, createComponent } from '@/lib/db';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ImportComponentsPage() {
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [csvData, setCsvData] = useState(null);
  const [preview, setPreview] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const params = useParams();
  const router = useRouter();
  const siteId = params.id;

  useEffect(() => {
    const loadData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        window.location.href = '/';
        return;
      }
      
      try {
        const siteData = await getSite(siteId);
        setSite(siteData);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [siteId]);

  // Generate and download sample CSV
  const downloadSampleCSV = () => {
    const sampleData = `category,description,quantity,unit,unitcost,usefullife,remaininglife,condition,pm,notes
Sitework,Asphalt Paving - Parking Lot,5000,SF,5.50,20,12,Good,No,Southeast section - some cracking visible
Sitework,Concrete Sidewalks,1200,LF,45,30,22,Excellent,No,Recently sealed
Sitework,Chain Link Fencing,800,LF,35,25,18,Good,No,Perimeter fencing
Sitework,Landscape Irrigation System,1,LS,15000,15,8,Fair,No,Needs controller replacement
Building,Roof Replacement - Flat EPDM,12000,SF,12,25,10,Good,No,Last inspected 2024
Building,Exterior Siding - Vinyl,8500,SF,8.50,30,20,Excellent,No,North and east facades
Building,Windows - Double Pane,45,Each,850,30,15,Good,No,Common area windows only
Building,Entry Doors - Steel,6,Each,2500,25,18,Good,No,Main building entrances
Building Exterior,Balcony Railings - Aluminum,24,Each,1200,35,25,Excellent,No,Recently powder coated
Building Exterior,Gutters and Downspouts,450,LF,18,20,12,Good,No,Includes cleaning schedule
Interior,Hallway Carpeting,2800,SY,32,10,4,Fair,No,High traffic areas showing wear
Interior,Lobby Furniture,1,LS,8500,12,6,Good,No,Seating and tables
Electrical,Emergency Generator,1,Each,45000,25,20,Excellent,No,Annual service contract in place
Electrical,Parking Lot Lighting,18,Each,1500,20,14,Good,No,LED retrofit completed
Electrical,Common Area Lighting,1,LS,12000,15,10,Good,No,Interior fixtures
Mechanical,HVAC System - Rooftop Units,4,Each,18000,20,8,Fair,No,Two units need attention
Mechanical,Boiler - Hot Water,2,Each,12000,25,17,Good,No,Annual inspections current
Mechanical,Elevator Modernization,1,Each,125000,30,18,Good,No,Cab interior only
Plumbing,Water Heater - Commercial,1,Each,8500,15,9,Good,No,80 gallon capacity
Plumbing,Sump Pumps,2,Each,2500,12,5,Fair,No,Backup pump recommended
Special,Pool Resurfacing,1,LS,35000,12,4,Fair,No,Marcite finish
Special,Clubhouse Kitchen Appliances,1,LS,15000,15,8,Good,No,Refrigerator and range
Special,Playground Equipment,1,LS,28000,20,12,Good,No,Includes safety surfacing
Mechanical,Paint - Building Exterior,8500,SF,4.50,8,3,Good,Yes,PM item - cyclical maintenance
Building Exterior,Seal Coat - Parking Lot,5000,SF,1.25,4,2,Good,Yes,PM item - preventive maintenance`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_components_import.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  // Helper function to parse CSV line respecting quotes
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Parse number - strips $ and commas
  const parseNumber = (value) => {
    if (!value || value === '') return 0;
    // Remove $, commas, and any whitespace
    const cleaned = String(value).replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      alert('CSV file must have a header row and at least one data row');
      return;
    }

    // Parse header - trim and lowercase each header
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim());
    
    console.log('CSV Headers found:', headers);
    console.log('PM column index:', headers.indexOf('pm'));
    
    // Map headers to expected field names
    const fieldMap = {
      'category': 'category',
      'description': 'description',
      'quantity': 'quantity',
      'unit': 'unit',
      'unitcost': 'unitCost',
      'unit cost': 'unitCost',
      'usefullife': 'usefulLife',
      'useful life': 'usefulLife',
      'remaininglife': 'remainingUsefulLife',
      'remaining life': 'remainingUsefulLife',
      'remainingusefullife': 'remainingUsefulLife',
      'condition': 'condition',
      'pm': 'pm',
      'preventivemaintenance': 'pm',
      'preventive maintenance': 'pm',
      'notes': 'notes'
    };

    // Parse data rows
    const components = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 2) continue; // Skip empty rows

      const component = {};
      headers.forEach((header, index) => {
        const fieldName = fieldMap[header];
        if (fieldName && values[index] !== undefined) {
          component[fieldName] = values[index];
        }
      });

      // Convert numeric fields
      component.quantity = parseNumber(component.quantity) || 1;
      component.unitCost = parseNumber(component.unitCost) || 0;
      component.usefulLife = parseNumber(component.usefulLife) || 1;
      component.remainingUsefulLife = parseNumber(component.remainingUsefulLife) || 1;
      
      // Calculate total cost
      component.totalCost = component.quantity * component.unitCost;
      
      // Handle PM field - be very explicit about parsing
      let pmRaw = component.pm || component.isPreventiveMaintenance || '';
      // Remove any quotes, whitespace, or hidden characters
      let pmValue = String(pmRaw).toLowerCase().replace(/['"]/g, '').trim();
      component.isPreventiveMaintenance = (pmValue === 'yes' || pmValue === 'true' || pmValue === '1' || pmValue === 'y');
      
      // Debug logging
      console.log(`Component: ${component.description}, PM raw: "${pmRaw}", PM parsed: ${component.pm}`);

      // Set defaults
      component.category = component.category || 'Other';
      component.unit = component.unit || 'Each';
      component.condition = component.condition || 'Good';
      component.notes = component.notes || '';

      if (component.description) {
        components.push(component);
      }
    }

    setCsvData(components);
    setPreview(components.slice(0, 5));
  };

  const handleImport = async () => {
    if (!csvData || csvData.length === 0) return;
    
    setImporting(true);
    setImportResult(null);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const component of csvData) {
      try {
        await createComponent(siteId, component);
        successCount++;
      } catch (error) {
        console.error('Error importing component:', error);
        errorCount++;
      }
    }
    
    setImportResult({ successCount, errorCount });
    setImporting(false);
    
    // Redirect after short delay
    if (successCount > 0) {
      setTimeout(() => {
        router.push(`/sites/${siteId}/components`);
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="w-full px-6 py-4">
          <Link href={`/sites/${siteId}/components`} className="text-red-600 hover:text-red-800">
            ← Back to Components
          </Link>
          <h1 className="text-2xl font-bold mt-2 text-gray-900">Import Components from CSV</h1>
          <p className="text-gray-600">{site?.siteName}</p>
        </div>
      </header>

      <main className="w-full px-6 py-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-blue-900 mb-3">CSV Format Instructions</h2>
          <p className="text-blue-800 mb-3">Your CSV file should have the following columns (header row required):</p>
          
          <div className="bg-white rounded p-3 font-mono text-sm text-gray-700 mb-4">
            category,description,quantity,unit,unitcost,usefullife,remaininglife,condition,pm,notes
          </div>
          
          <p className="text-blue-800 mb-4">
            <strong>Note:</strong> Unit cost should be a plain number (e.g., <code className="bg-white px-1 rounded">5.50</code> or <code className="bg-white px-1 rounded">12000</code>). 
            Avoid dollar signs and commas for best results.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <strong>Valid Categories:</strong>
              <ul className="list-disc list-inside ml-2">
                <li>Sitework</li>
                <li>Building</li>
                <li>Building Exterior</li>
                <li>Interior</li>
                <li>Electrical</li>
                <li>Mechanical</li>
                <li>Plumbing</li>
                <li>Special</li>
              </ul>
            </div>
            <div>
              <strong>Valid Units:</strong>
              <ul className="list-disc list-inside ml-2">
                <li>Each</li>
                <li>SF (Square Feet)</li>
                <li>LF (Linear Feet)</li>
                <li>SY (Square Yards)</li>
                <li>Gallons</li>
                <li>Units</li>
                <li>LS (Lump Sum)</li>
              </ul>
            </div>
            <div>
              <strong>Valid Conditions:</strong>
              <ul className="list-disc list-inside ml-2">
                <li>Excellent</li>
                <li>Good</li>
                <li>Fair</li>
                <li>Poor</li>
              </ul>
            </div>
            <div>
              <strong>PM (Preventive Maintenance):</strong>
              <ul className="list-disc list-inside ml-2">
                <li>Yes or No</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">1. Upload CSV File</h2>
          
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-4">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full sm:w-auto text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none p-2"
            />
            
            <span className="text-gray-500">or</span>
            
            <button
              onClick={downloadSampleCSV}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-300 font-medium text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Sample CSV
            </button>
          </div>
          
          <p className="text-sm text-gray-500">
            Download the sample to see the correct format with 25 example components, then modify it with your data.
          </p>
        </div>

        {/* Preview Section */}
        {preview.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              2. Preview (showing {Math.min(preview.length, 5)} of {csvData.length} components)
            </h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Category</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Description</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Qty</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Unit Cost</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Total</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Life</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">PM</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.map((comp, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-sm text-gray-900">{comp.category}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{comp.description}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{comp.quantity} {comp.unit}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">${comp.unitCost?.toLocaleString()}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 font-medium">${comp.totalCost?.toLocaleString()}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">{comp.usefulLife}y / {comp.remainingUsefulLife}y rem</td>
                      <td className="px-3 py-2 text-sm">
                        {comp.isPreventiveMaintenance ? (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">Yes</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Validation warnings */}
            {csvData.some(c => c.unitCost === 0) && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                ⚠️ Warning: {csvData.filter(c => c.unitCost === 0).length} component(s) have $0 unit cost. 
                Please verify this is correct.
              </div>
            )}
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className={`p-4 rounded-lg mb-6 ${importResult.errorCount > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
            <p className={importResult.errorCount > 0 ? 'text-yellow-800' : 'text-green-800'}>
              ✅ Successfully imported {importResult.successCount} component(s)
              {importResult.errorCount > 0 && ` (${importResult.errorCount} failed)`}
            </p>
            <p className="text-sm text-gray-600 mt-1">Redirecting to components list...</p>
          </div>
        )}

        {/* Import Button */}
        {csvData && csvData.length > 0 && !importResult && (
          <div className="flex justify-end gap-4">
            <Link
              href={`/sites/${siteId}/components`}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              Cancel
            </Link>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium"
            >
              {importing ? `Importing... (${csvData.length})` : `Import ${csvData.length} Components`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
