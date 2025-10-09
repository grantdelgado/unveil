#!/usr/bin/env node

/**
 * AASA Validator - Post-Deploy Verification Script
 * 
 * Validates that the Apple App Site Association file is properly deployed
 * with the correct Team ID for Universal Links functionality.
 * 
 * Usage: node scripts/verify-aasa.mjs
 * Exit codes: 0 = success, 1 = validation failed, 2 = network/parsing error
 */

import { execSync } from 'child_process';

const PRODUCTION_URL = 'https://app.sendunveil.com/.well-known/apple-app-site-association';
const EXPECTED_TEAM_ID = '4YMP78MK33.com.unveil.wedding';
const TIMEOUT_MS = 10000; // 10 seconds

/**
 * Fetch AASA file with timeout and error handling
 */
async function fetchAASA() {
  try {
    console.log(`🔍 Fetching AASA from: ${PRODUCTION_URL}`);
    
    // Use curl with timeout for reliable network request
    const curlCommand = `curl -fsSL --max-time 10 "${PRODUCTION_URL}"`;
    const response = execSync(curlCommand, { 
      encoding: 'utf8',
      timeout: TIMEOUT_MS 
    });
    
    console.log(`✅ AASA fetched successfully (${response.length} bytes)`);
    return response;
  } catch (error) {
    console.error(`❌ Failed to fetch AASA file:`);
    console.error(`   URL: ${PRODUCTION_URL}`);
    console.error(`   Error: ${error.message}`);
    throw new Error(`Network request failed: ${error.message}`);
  }
}

/**
 * Parse and validate AASA JSON structure
 */
function parseAndValidateAASA(content) {
  try {
    const aasa = JSON.parse(content);
    console.log(`✅ AASA JSON parsed successfully`);
    
    // Validate basic structure
    if (!aasa.applinks || !aasa.applinks.details) {
      throw new Error('Invalid AASA structure: missing applinks.details');
    }
    
    console.log(`📋 Found ${aasa.applinks.details.length} app configuration(s)`);
    return aasa;
  } catch (error) {
    console.error(`❌ Failed to parse AASA JSON:`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Content preview: ${content.substring(0, 200)}...`);
    throw new Error(`JSON parsing failed: ${error.message}`);
  }
}

/**
 * Validate Team ID presence in AASA configuration
 */
function validateTeamID(aasa) {
  console.log(`🔍 Validating Team ID: ${EXPECTED_TEAM_ID}`);
  
  let foundTeamID = false;
  let foundPlaceholder = false;
  
  // Check all app configurations
  for (const detail of aasa.applinks.details) {
    // Handle both old format (appID) and new format (appIDs)
    const appIDs = detail.appIDs || [detail.appID];
    
    for (const appID of appIDs) {
      if (appID === EXPECTED_TEAM_ID) {
        foundTeamID = true;
        console.log(`✅ Found correct Team ID: ${appID}`);
      } else if (appID && appID.includes('TEAMID')) {
        foundPlaceholder = true;
        console.log(`⚠️  Found placeholder Team ID: ${appID}`);
      }
    }
  }
  
  // Check webcredentials and activitycontinuation sections
  if (aasa.webcredentials && aasa.webcredentials.apps) {
    for (const app of aasa.webcredentials.apps) {
      if (app === EXPECTED_TEAM_ID) {
        console.log(`✅ Found Team ID in webcredentials: ${app}`);
      } else if (app && app.includes('TEAMID')) {
        console.log(`⚠️  Found placeholder in webcredentials: ${app}`);
      }
    }
  }
  
  if (aasa.activitycontinuation && aasa.activitycontinuation.apps) {
    for (const app of aasa.activitycontinuation.apps) {
      if (app === EXPECTED_TEAM_ID) {
        console.log(`✅ Found Team ID in activitycontinuation: ${app}`);
      } else if (app && app.includes('TEAMID')) {
        console.log(`⚠️  Found placeholder in activitycontinuation: ${app}`);
      }
    }
  }
  
  return { foundTeamID, foundPlaceholder };
}

/**
 * Main validation function
 */
async function validateAASA() {
  console.log('🚀 Starting AASA validation...');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Step 1: Fetch AASA file
    const content = await fetchAASA();
    
    // Step 2: Parse JSON
    const aasa = parseAndValidateAASA(content);
    
    // Step 3: Validate Team ID
    const { foundTeamID, foundPlaceholder } = validateTeamID(aasa);
    
    // Step 4: Determine result
    if (foundTeamID) {
      console.log(`\n🎉 VALIDATION PASSED`);
      console.log(`✅ Team ID ${EXPECTED_TEAM_ID} found in production AASA`);
      
      if (foundPlaceholder) {
        console.log(`⚠️  Note: Placeholder 'TEAMID' also found (mixed state)`);
      }
      
      return true;
    } else {
      console.log(`\n❌ VALIDATION FAILED`);
      console.log(`❌ Team ID ${EXPECTED_TEAM_ID} NOT found in production AASA`);
      
      if (foundPlaceholder) {
        console.log(`❌ Only placeholder 'TEAMID' found - deployment incomplete`);
      } else {
        console.log(`❌ No Team ID found at all - configuration error`);
      }
      
      return false;
    }
    
  } catch (error) {
    console.error(`\n💥 VALIDATION ERROR`);
    console.error(`❌ ${error.message}`);
    return false;
  }
}

/**
 * CLI entry point
 */
async function main() {
  const success = await validateAASA();
  
  if (success) {
    console.log(`\n✅ AASA validation completed successfully`);
    process.exit(0);
  } else {
    console.log(`\n❌ AASA validation failed`);
    console.log(`🔧 Check deployment status and Team ID configuration`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`💥 Unexpected error: ${error.message}`);
    process.exit(2);
  });
}

export { validateAASA };
