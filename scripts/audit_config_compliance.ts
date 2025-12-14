/**
 * CONFIG COMPLIANCE AUDIT SCRIPT
 *
 * Audits the repository against global_config.yaml to check for:
 * - Pass-1 Hub spoke implementation
 * - Pass-2 Hub spoke implementation
 * - IMO-RA architecture compliance
 * - Master Failure Hub integration
 * - Database table configuration
 * - CTB Doctrine compliance
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

// ============================================================================
// TYPES
// ============================================================================

interface AuditResult {
  category: string;
  item: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'INFO';
  message: string;
}

interface AuditSummary {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  results: AuditResult[];
}

// ============================================================================
// FILE SYSTEM HELPERS
// ============================================================================

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function listFiles(dirPath: string, extension?: string): string[] {
  try {
    const files = fs.readdirSync(dirPath);
    if (extension) {
      return files.filter(f => f.endsWith(extension));
    }
    return files;
  } catch {
    return [];
  }
}

// ============================================================================
// AUDIT FUNCTIONS
// ============================================================================

function auditPass1Spokes(config: any, rootDir: string): AuditResult[] {
  const results: AuditResult[] = [];
  const configSpokes: string[] = config.pass1_hub?.spokes || [];
  const spokesDir = path.join(rootDir, 'src', 'pass1_hub', 'spokes');
  const existingSpokes = listFiles(spokesDir, '.ts').map(f => f.replace('.ts', ''));

  results.push({
    category: 'Pass-1 Hub',
    item: 'Spokes Directory',
    status: fileExists(spokesDir) ? 'PASS' : 'FAIL',
    message: fileExists(spokesDir) ? `Found at ${spokesDir}` : 'Directory not found',
  });

  for (const spoke of configSpokes) {
    const found = existingSpokes.includes(spoke);
    results.push({
      category: 'Pass-1 Hub',
      item: `Spoke: ${spoke}`,
      status: found ? 'PASS' : 'FAIL',
      message: found ? `${spoke}.ts exists` : `${spoke}.ts NOT FOUND`,
    });
  }

  // Check for extra spokes not in config
  for (const file of existingSpokes) {
    if (!configSpokes.includes(file)) {
      results.push({
        category: 'Pass-1 Hub',
        item: `Extra Spoke: ${file}`,
        status: 'WARN',
        message: `${file}.ts exists but not in config`,
      });
    }
  }

  // Check orchestrator
  const orchestratorPath = path.join(rootDir, 'src', 'pass1_hub', 'orchestrator', 'Pass1Orchestrator.ts');
  results.push({
    category: 'Pass-1 Hub',
    item: 'Orchestrator',
    status: fileExists(orchestratorPath) ? 'PASS' : 'FAIL',
    message: fileExists(orchestratorPath) ? 'Pass1Orchestrator.ts exists' : 'Orchestrator NOT FOUND',
  });

  return results;
}

function auditPass2Spokes(config: any, rootDir: string): AuditResult[] {
  const results: AuditResult[] = [];
  const configSpokes: string[] = config.pass2_hub?.spokes || [];
  const spokesDir = path.join(rootDir, 'src', 'pass2_hub', 'spokes');
  const existingSpokes = listFiles(spokesDir, '.ts').map(f => f.replace('.ts', ''));

  results.push({
    category: 'Pass-2 Hub',
    item: 'Spokes Directory',
    status: fileExists(spokesDir) ? 'PASS' : 'FAIL',
    message: fileExists(spokesDir) ? `Found at ${spokesDir}` : 'Directory not found',
  });

  for (const spoke of configSpokes) {
    const found = existingSpokes.includes(spoke);
    results.push({
      category: 'Pass-2 Hub',
      item: `Spoke: ${spoke}`,
      status: found ? 'PASS' : 'FAIL',
      message: found ? `${spoke}.ts exists` : `${spoke}.ts NOT FOUND`,
    });
  }

  // Check for extra spokes not in config
  for (const file of existingSpokes) {
    if (!configSpokes.includes(file)) {
      results.push({
        category: 'Pass-2 Hub',
        item: `Extra Spoke: ${file}`,
        status: 'WARN',
        message: `${file}.ts exists but not in config`,
      });
    }
  }

  // Check orchestrator
  const orchestratorPath = path.join(rootDir, 'src', 'pass2_hub', 'orchestrator', 'Pass2Orchestrator.ts');
  results.push({
    category: 'Pass-2 Hub',
    item: 'Orchestrator',
    status: fileExists(orchestratorPath) ? 'PASS' : 'FAIL',
    message: fileExists(orchestratorPath) ? 'Pass2Orchestrator.ts exists' : 'Orchestrator NOT FOUND',
  });

  // Check types file
  const typesPath = path.join(rootDir, 'src', 'pass2_hub', 'types', 'pass2_types.ts');
  results.push({
    category: 'Pass-2 Hub',
    item: 'Types Definition',
    status: fileExists(typesPath) ? 'PASS' : 'FAIL',
    message: fileExists(typesPath) ? 'pass2_types.ts exists' : 'Types file NOT FOUND',
  });

  return results;
}

function auditIMORAArchitecture(config: any, rootDir: string): AuditResult[] {
  const results: AuditResult[] = [];

  // Check IMO-RA schema
  const schemaPath = path.join(rootDir, 'config', 'global-config', 'imo-ra-schema.json');
  results.push({
    category: 'IMO-RA',
    item: 'Schema File',
    status: fileExists(schemaPath) ? 'PASS' : 'FAIL',
    message: fileExists(schemaPath) ? 'imo-ra-schema.json exists' : 'Schema NOT FOUND',
  });

  // Check architecture instance
  const archPath = path.join(rootDir, 'imo-architecture.json');
  results.push({
    category: 'IMO-RA',
    item: 'Architecture Instance',
    status: fileExists(archPath) ? 'PASS' : 'FAIL',
    message: fileExists(archPath) ? 'imo-architecture.json exists' : 'Architecture file NOT FOUND',
  });

  // Validate architecture content
  if (fileExists(archPath)) {
    try {
      const archContent = JSON.parse(readFile(archPath) || '{}');

      // Check central hub
      results.push({
        category: 'IMO-RA',
        item: 'Central Hub',
        status: archContent.centralHub?.name ? 'PASS' : 'FAIL',
        message: archContent.centralHub?.name || 'Central hub not defined',
      });

      // Check primary hubs
      const primaryHubs = archContent.centralHub?.primaryHubs || [];
      results.push({
        category: 'IMO-RA',
        item: 'Primary Hubs Count',
        status: primaryHubs.length >= 3 ? 'PASS' : 'WARN',
        message: `${primaryHubs.length} primary hubs defined`,
      });

      // Check failure system
      results.push({
        category: 'IMO-RA',
        item: 'Failure System',
        status: archContent.failureSystem?.masterFailureHub ? 'PASS' : 'FAIL',
        message: archContent.failureSystem?.masterFailureHub ? 'Master Failure Hub defined' : 'Failure system not configured',
      });

    } catch (e) {
      results.push({
        category: 'IMO-RA',
        item: 'Architecture Validation',
        status: 'FAIL',
        message: `Invalid JSON: ${e}`,
      });
    }
  }

  // Check global manifest
  const manifestPath = path.join(rootDir, 'config', 'global-config', 'global_manifest.yaml');
  results.push({
    category: 'IMO-RA',
    item: 'Global Manifest',
    status: fileExists(manifestPath) ? 'PASS' : 'FAIL',
    message: fileExists(manifestPath) ? 'global_manifest.yaml exists' : 'Manifest NOT FOUND',
  });

  return results;
}

function auditMasterFailureHub(config: any, rootDir: string): AuditResult[] {
  const results: AuditResult[] = [];

  // Check implementation file
  const hubPath = path.join(rootDir, 'src', 'shared', 'failures', 'MasterFailureHub.ts');
  results.push({
    category: 'Master Failure Hub',
    item: 'Implementation',
    status: fileExists(hubPath) ? 'PASS' : 'FAIL',
    message: fileExists(hubPath) ? 'MasterFailureHub.ts exists' : 'Implementation NOT FOUND',
  });

  // Check config
  const imoRaConfig = config.imo_ra;
  results.push({
    category: 'Master Failure Hub',
    item: 'Config Section',
    status: imoRaConfig?.failure_system ? 'PASS' : 'FAIL',
    message: imoRaConfig?.failure_system ? 'imo_ra.failure_system configured' : 'Config section missing',
  });

  // Check severity levels in config
  const severityLevels = imoRaConfig?.failure_system?.severity_levels || [];
  results.push({
    category: 'Master Failure Hub',
    item: 'Severity Levels',
    status: severityLevels.length >= 4 ? 'PASS' : 'WARN',
    message: `${severityLevels.length} severity levels defined`,
  });

  // Check auto-repair config
  const autoRepair = imoRaConfig?.failure_system?.propagation?.auto_repair;
  results.push({
    category: 'Master Failure Hub',
    item: 'Auto-Repair Config',
    status: autoRepair ? 'PASS' : 'WARN',
    message: autoRepair ? 'Auto-repair configured' : 'Auto-repair not configured',
  });

  return results;
}

function auditDatabaseConfig(config: any, rootDir: string): AuditResult[] {
  const results: AuditResult[] = [];

  const tables = config.database?.tables || {};
  const requiredTables = ['pass1_runs', 'pass2_runs', 'staging_payload', 'vault', 'engine_logs'];

  for (const table of requiredTables) {
    results.push({
      category: 'Database',
      item: `Table: ${table}`,
      status: tables[table] ? 'PASS' : 'WARN',
      message: tables[table] ? `Mapped to "${tables[table]}"` : 'Not configured in tables section',
    });
  }

  // Check Lovable adapter
  const adapterPath = path.join(rootDir, 'src', 'shared', 'adapters', 'LovableAdapter.ts');
  results.push({
    category: 'Database',
    item: 'Lovable Adapter',
    status: fileExists(adapterPath) ? 'PASS' : 'FAIL',
    message: fileExists(adapterPath) ? 'LovableAdapter.ts exists' : 'Adapter NOT FOUND',
  });

  return results;
}

function auditGlobalConfig(config: any, rootDir: string): AuditResult[] {
  const results: AuditResult[] = [];

  // Check TypeScript loader
  const tsLoaderPath = path.join(rootDir, 'src', 'config', 'GlobalConfig.ts');
  results.push({
    category: 'Global Config',
    item: 'TypeScript Loader',
    status: fileExists(tsLoaderPath) ? 'PASS' : 'FAIL',
    message: fileExists(tsLoaderPath) ? 'GlobalConfig.ts exists' : 'TS Loader NOT FOUND',
  });

  // Check Python loader
  const pyLoaderPath = path.join(rootDir, 'imo_creator', 'config', 'credentials.py');
  results.push({
    category: 'Global Config',
    item: 'Python Loader',
    status: fileExists(pyLoaderPath) ? 'PASS' : 'FAIL',
    message: fileExists(pyLoaderPath) ? 'credentials.py exists' : 'Python Loader NOT FOUND',
  });

  // Check doctrine flags
  const doctrine = config.doctrine || {};
  const requiredFlags = ['STAMPED', 'SPVPET', 'STACKED', 'BARTON_DOCTRINE'];
  for (const flag of requiredFlags) {
    results.push({
      category: 'Global Config',
      item: `Doctrine: ${flag}`,
      status: doctrine[flag] === true ? 'PASS' : 'WARN',
      message: doctrine[flag] === true ? 'Enabled' : 'Not enabled or missing',
    });
  }

  // Check CTB doctrine section
  const ctbDoctrine = config.ctb_doctrine;
  results.push({
    category: 'Global Config',
    item: 'CTB Doctrine Section',
    status: ctbDoctrine ? 'PASS' : 'WARN',
    message: ctbDoctrine ? 'ctb_doctrine section present' : 'CTB doctrine section missing',
  });

  return results;
}

function auditValidators(config: any, rootDir: string): AuditResult[] {
  const results: AuditResult[] = [];

  // Check Pass-1 to Pass-2 validator
  const validatorPath = path.join(rootDir, 'src', 'pipeline', 'Pass1ToPass2Validator.ts');
  results.push({
    category: 'Validators',
    item: 'Pass1ToPass2Validator',
    status: fileExists(validatorPath) ? 'PASS' : 'FAIL',
    message: fileExists(validatorPath) ? 'Validator exists' : 'Validator NOT FOUND',
  });

  // Check OpportunityObject
  const oppObjPath = path.join(rootDir, 'src', 'shared', 'OpportunityObject.ts');
  results.push({
    category: 'Validators',
    item: 'OpportunityObject',
    status: fileExists(oppObjPath) ? 'PASS' : 'FAIL',
    message: fileExists(oppObjPath) ? 'OpportunityObject.ts exists' : 'NOT FOUND',
  });

  return results;
}

function auditEdgeFunctions(config: any, rootDir: string): AuditResult[] {
  const results: AuditResult[] = [];

  // Map of required functions with their alternate names (snake_case -> camelCase)
  const requiredFunctions: { name: string; alternates: string[] }[] = [
    { name: 'start_pass1', alternates: ['startPass1'] },
    { name: 'start_pass2', alternates: ['startPass2'] },
    { name: 'save_to_vault', alternates: ['saveToVault'] },
  ];

  // Check src/edge_functions
  const srcEdgePath = path.join(rootDir, 'src', 'edge_functions');
  for (const func of requiredFunctions) {
    const funcPath = path.join(srcEdgePath, `${func.name}.ts`);
    results.push({
      category: 'Edge Functions',
      item: `src/edge_functions/${func.name}`,
      status: fileExists(funcPath) ? 'PASS' : 'WARN',
      message: fileExists(funcPath) ? 'File exists' : 'Not found in src/edge_functions',
    });
  }

  // Check supabase/functions (try both snake_case and camelCase)
  const supabaseFuncsPath = path.join(rootDir, 'supabase', 'functions');
  for (const func of requiredFunctions) {
    const funcPath = path.join(supabaseFuncsPath, func.name, 'index.ts');
    const alternatePaths = func.alternates.map(alt => path.join(supabaseFuncsPath, alt, 'index.ts'));

    const primaryExists = fileExists(funcPath);
    const alternateExists = alternatePaths.some(p => fileExists(p));
    const foundAlternate = func.alternates.find((alt, i) => fileExists(alternatePaths[i]));

    if (primaryExists) {
      results.push({
        category: 'Edge Functions',
        item: `supabase/functions/${func.name}`,
        status: 'PASS',
        message: 'Exists',
      });
    } else if (alternateExists) {
      results.push({
        category: 'Edge Functions',
        item: `supabase/functions/${func.name}`,
        status: 'PASS',
        message: `Exists as ${foundAlternate}`,
      });
    } else {
      results.push({
        category: 'Edge Functions',
        item: `supabase/functions/${func.name}`,
        status: 'WARN',
        message: 'Not found',
      });
    }
  }

  return results;
}

// ============================================================================
// MAIN AUDIT FUNCTION
// ============================================================================

function runAudit(): AuditSummary {
  const rootDir = process.cwd();
  const configPath = path.join(rootDir, 'config', 'global_config.yaml');

  console.log('='.repeat(80));
  console.log('STORAGE SITE SCOUT - CONFIG COMPLIANCE AUDIT');
  console.log('='.repeat(80));
  console.log(`Root Directory: ${rootDir}`);
  console.log(`Config File: ${configPath}`);
  console.log('='.repeat(80));
  console.log('');

  // Load config
  const configContent = readFile(configPath);
  if (!configContent) {
    console.error('ERROR: Could not read global_config.yaml');
    return { total: 0, passed: 0, failed: 1, warnings: 0, results: [] };
  }

  let config: any;
  try {
    config = yaml.parse(configContent);
  } catch (e) {
    console.error('ERROR: Invalid YAML in global_config.yaml:', e);
    return { total: 0, passed: 0, failed: 1, warnings: 0, results: [] };
  }

  // Run all audits
  const allResults: AuditResult[] = [
    ...auditPass1Spokes(config, rootDir),
    ...auditPass2Spokes(config, rootDir),
    ...auditIMORAArchitecture(config, rootDir),
    ...auditMasterFailureHub(config, rootDir),
    ...auditDatabaseConfig(config, rootDir),
    ...auditGlobalConfig(config, rootDir),
    ...auditValidators(config, rootDir),
    ...auditEdgeFunctions(config, rootDir),
  ];

  // Calculate summary
  const summary: AuditSummary = {
    total: allResults.length,
    passed: allResults.filter(r => r.status === 'PASS').length,
    failed: allResults.filter(r => r.status === 'FAIL').length,
    warnings: allResults.filter(r => r.status === 'WARN').length,
    results: allResults,
  };

  // Print results by category
  const categories = [...new Set(allResults.map(r => r.category))];

  for (const category of categories) {
    console.log(`\n## ${category}`);
    console.log('-'.repeat(60));

    const categoryResults = allResults.filter(r => r.category === category);
    for (const result of categoryResults) {
      const icon = result.status === 'PASS' ? '[PASS]' :
                   result.status === 'FAIL' ? '[FAIL]' :
                   result.status === 'WARN' ? '[WARN]' : '[INFO]';
      console.log(`${icon} ${result.item}: ${result.message}`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Checks:  ${summary.total}`);
  console.log(`Passed:        ${summary.passed} (${Math.round(summary.passed / summary.total * 100)}%)`);
  console.log(`Failed:        ${summary.failed}`);
  console.log(`Warnings:      ${summary.warnings}`);
  console.log('='.repeat(80));

  const complianceScore = Math.round((summary.passed / summary.total) * 100);
  const status = summary.failed === 0 ? 'COMPLIANT' :
                 summary.failed <= 3 ? 'PARTIAL COMPLIANCE' : 'NON-COMPLIANT';

  console.log(`\nCOMPLIANCE SCORE: ${complianceScore}%`);
  console.log(`STATUS: ${status}`);

  if (summary.failed > 0) {
    console.log('\n## REQUIRED FIXES:');
    for (const result of allResults.filter(r => r.status === 'FAIL')) {
      console.log(`  - [${result.category}] ${result.item}: ${result.message}`);
    }
  }

  return summary;
}

// Run the audit
runAudit();
