import { hashPassword } from './auth';
import { ApiError } from './errors';
import {
  createSessionRecord,
  deleteSessionRecord,
  findSessionByAnyToken,
  findSessionByEditToken,
  touchSessionAccess,
  touchSessionUpdate,
  updateSessionCounts,
} from './registry-db';
import {
  applyNewRoutesDelta,
  cloneSessionDb,
  countRoutes,
  countTrips,
  deleteSessionDb,
  getAllSessionMetadata,
  getNewRoutesVersion,
  getOptimization,
  getSettings,
  listDepots,
  listVehicleTypes,
  listRoutes,
  listNewRoutes,
  listTrips,
  saveSessionState,
} from './session-db';
import { generateToken } from './tokens';
import type { AccessLevel, BidResult, NewRouteRow, NewRoutesDeltaResult, PartialSessionState, SessionMetadata, SessionRecord, SessionState, SessionStateUpdateInput } from './types';

const MAX_TOKEN_GENERATION_ATTEMPTS = 8;

function generateUniqueTokenPair(): { editToken: string; readonlyToken: string } {
  for (let i = 0; i < MAX_TOKEN_GENERATION_ATTEMPTS; i += 1) {
    const editToken = generateToken();
    const readonlyToken = generateToken();
    if (editToken === readonlyToken) {
      continue;
    }
    if (!findSessionByAnyToken(editToken) && !findSessionByAnyToken(readonlyToken)) {
      return { editToken, readonlyToken };
    }
  }

  throw new ApiError(500, 'token_generation_failed', 'Failed to generate unique session tokens.');
}

export async function createClearcutSession(input?: {
  name?: string;
  password?: string | null;
}): Promise<SessionRecord> {
  const { editToken, readonlyToken } = generateUniqueTokenPair();
  const passwordHash = input?.password ? await hashPassword(input.password) : null;
  const record = createSessionRecord({
    editToken,
    readonlyToken,
    name: input?.name,
    passwordHash,
  });

  // Provision the session database and seed defaults.
  getSettings(editToken);
  getOptimization(editToken);

  return record;
}

export function getSessionState(record: SessionRecord, access: AccessLevel = 'edit'): SessionState {
  touchSessionAccess(record.edit_token);
  const optimization = getOptimization(record.edit_token);

  let bidResult: BidResult | null = null;
  if (optimization.bid_result_json) {
    try {
      bidResult = JSON.parse(optimization.bid_result_json) as BidResult;
    } catch {
      bidResult = null;
    }
  }

  return {
    session: {
      edit_token: access === 'edit' ? record.edit_token : null,
      readonly_token: record.readonly_token,
      name: record.name,
      created_at: record.created_at,
      updated_at: record.updated_at,
      accessed_at: record.accessed_at,
      trip_count: record.trip_count,
      route_count: record.route_count,
      has_password: Boolean(record.password_hash),
    },
    settings: getSettings(record.edit_token),
    optimization,
    trips: listTrips(record.edit_token),
    routes: listRoutes(record.edit_token),
    new_routes: listNewRoutes(record.edit_token),
    depots: listDepots(record.edit_token),
    vehicle_types: listVehicleTypes(record.edit_token),
    bid_result: bidResult,
  };
}

export function getSessionMetadataResponse(record: SessionRecord, access: AccessLevel = 'edit'): SessionMetadata {
  touchSessionAccess(record.edit_token);
  return getAllSessionMetadata(record.edit_token, access, record);
}

export function saveAndRefreshSessionState(
  record: SessionRecord,
  input: SessionStateUpdateInput,
): { record: SessionRecord; deltaResult?: NewRoutesDeltaResult } {
  let deltaResult: NewRoutesDeltaResult | undefined;

  if (input.new_routes_delta) {
    deltaResult = applyNewRoutesDelta(record.edit_token, input.new_routes_delta);
  }

  saveSessionState(record.edit_token, input);

  if (input.trips || input.routes) {
    const tripCount = input.trips ? countTrips(record.edit_token) : record.trip_count;
    const routeCount = input.routes ? countRoutes(record.edit_token) : record.route_count;
    updateSessionCounts(record.edit_token, tripCount, routeCount);
  }

  touchSessionUpdate(record.edit_token);

  const updated = findSessionByEditToken(record.edit_token);
  if (!updated) {
    throw new ApiError(500, 'session_refresh_failed', 'Session was not found after update.');
  }

  return { record: updated, deltaResult };
}

export function getPartialSessionState(
  record: SessionRecord,
  updatedFields: Set<string>,
  deltaResult?: NewRoutesDeltaResult,
): PartialSessionState {
  touchSessionAccess(record.edit_token);

  const optimization = updatedFields.has('optimization')
    ? getOptimization(record.edit_token)
    : null;

  let bidResult: BidResult | null = null;
  if (optimization?.bid_result_json) {
    try {
      bidResult = JSON.parse(optimization.bid_result_json) as BidResult;
    } catch {
      bidResult = null;
    }
  }

  let newRoutes: NewRouteRow[] | null = null;
  let newRoutesVersion: number | undefined;
  let newRoutesConflict: boolean | undefined;

  if (deltaResult) {
    newRoutesVersion = deltaResult.version;
    if (deltaResult.conflict) {
      newRoutesConflict = true;
      newRoutes = deltaResult.all;
    }
  } else if (updatedFields.has('new_routes')) {
    newRoutes = listNewRoutes(record.edit_token);
    newRoutesVersion = getNewRoutesVersion(record.edit_token);
  }

  return {
    session: {
      edit_token: record.edit_token,
      readonly_token: record.readonly_token,
      name: record.name,
      created_at: record.created_at,
      updated_at: record.updated_at,
      accessed_at: record.accessed_at,
      trip_count: record.trip_count,
      route_count: record.route_count,
      has_password: Boolean(record.password_hash),
    },
    settings: updatedFields.has('settings') ? getSettings(record.edit_token) : null,
    optimization,
    trips: updatedFields.has('trips') ? listTrips(record.edit_token) : null,
    routes: updatedFields.has('routes') ? listRoutes(record.edit_token) : null,
    new_routes: newRoutes,
    depots: updatedFields.has('depots') ? listDepots(record.edit_token) : null,
    vehicle_types: updatedFields.has('vehicle_types') ? listVehicleTypes(record.edit_token) : null,
    bid_result: bidResult,
    new_routes_version: newRoutesVersion,
    new_routes_conflict: newRoutesConflict,
  };
}

export async function cloneClearcutSession(source: SessionRecord): Promise<SessionRecord> {
  const { editToken, readonlyToken } = generateUniqueTokenPair();

  const cloned = createSessionRecord({
    editToken,
    readonlyToken,
    name: `${source.name} (Copy)`,
    passwordHash: source.password_hash,
  });

  cloneSessionDb(source.edit_token, editToken);
  const tripCount = countTrips(editToken);
  const routeCount = countRoutes(editToken);
  updateSessionCounts(editToken, tripCount, routeCount);
  return cloned;
}

export function deleteClearcutSession(editToken: string): void {
  deleteSessionRecord(editToken);
  deleteSessionDb(editToken);
}
