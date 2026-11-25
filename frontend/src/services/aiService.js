import API from './api';

// Keep the session format used by the existing Navbar, Profile and API client.
const saveAuthSession = (data) => {
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('user', JSON.stringify(data.user));
};

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const formatValidationDetails = (items) => items.map((item) => {
  if (typeof item === 'string') return item;
  if (!isObject(item)) return String(item);
  const field = Array.isArray(item.loc)
    ? item.loc.filter((part) => part !== 'body').join('.')
    : '';
  const message = item.msg || item.message || 'Invalid value';
  return field ? `${field}: ${message}` : String(message);
}).join('; ');

const getErrorMessage = (error, fallback) => {
  const body = error?.response?.data;
  const detail = body?.detail;

  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) return formatValidationDetails(detail);
  if (isObject(detail)) {
    if (typeof detail.message === 'string' && detail.message.trim()) return detail.message;
    if (typeof detail.msg === 'string' && detail.msg.trim()) return detail.msg;
  }
  if (typeof body?.message === 'string' && body.message.trim()) return body.message;

  // A network failure is actionable; an Axios status-code message alone isn't.
  if (error?.code === 'ERR_NETWORK' || (!error?.response && error?.request)) {
    return 'Cannot connect to the Journey Gen AI server. Check that FastAPI is running and try again.';
  }
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return 'The server request timed out. Please try again.';
  }
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  return message && !/^Request failed with status code \d+$/i.test(message) ? message : fallback;
};

const requireId = (value, label) => {
  if (value === null || value === undefined || !String(value).trim()) {
    throw new Error(`${label} is required.`);
  }
  return encodeURIComponent(String(value).trim());
};

// The FastAPI TripSaveRequest requires title, formData and itinerary.
// Do not modify or reformat the itinerary or preferences: the saved trip must
// be identical to the generated trip, including accepted day replacements.
const validateTripPayload = (payload) => {
  if (!isObject(payload)) throw new Error('Trip details are required to save a trip.');
  if (typeof payload.title !== 'string' || !payload.title.trim()) {
    throw new Error('A trip title is required.');
  }
  if (!isObject(payload.formData)) {
    throw new Error('Trip preferences are missing. Regenerate the trip before saving.');
  }
  if (typeof payload.itinerary !== 'string' || !payload.itinerary.trim()) {
    throw new Error('The complete itinerary is required before saving.');
  }
  return payload;
};

const validateSavedTrip = (value, action) => {
  if (!isObject(value) || !value.id || !isObject(value.formData) ||
      typeof value.itinerary !== 'string') {
    throw new Error(`${action}: the server returned an incomplete saved trip.`);
  }
  return value;
};

// JSON object key ordering is not part of the saved-trip data contract.
// Compare actual data rather than object insertion order when verifying a save.
const canonicalJson = (value) => JSON.stringify(value, (_key, item) => {
  if (!isObject(item)) return item;
  return Object.keys(item).sort().reduce((sorted, key) => {
    sorted[key] = item[key];
    return sorted;
  }, {});
});

const verifyTripSave = (stored, original) => {
  validateSavedTrip(stored, 'Save trip');
  if (stored.itinerary !== original.itinerary ||
      stored.title !== original.title ||
      canonicalJson(stored.formData) !== canonicalJson(original.formData)) {
    throw new Error(
      'The server returned different trip details than those submitted. ' +
      'The trip may already be saved; open My Saved Trips to verify before trying again.'
    );
  }
  return stored;
};

export const registerUser = async (userDetails) => {
  try {
    const response = await API.post('/auth/register', userDetails);
    saveAuthSession(response.data);
    return response.data;
  } catch (error) {
    console.error('Registration error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to create your account. Please try again.'));
  }
};

export const loginUser = async (loginDetails) => {
  try {
    const response = await API.post('/auth/login', loginDetails);
    saveAuthSession(response.data);
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to log in. Please check your email and password.'));
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await API.get('/auth/me');
    return response.data;
  } catch (error) {
    console.error('Get user error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to get user details.'));
  }
};

export const updateCurrentUser = async (profileDetails) => {
  try {
    const response = await API.patch('/auth/me', {
      first_name: profileDetails.first_name ?? '',
      middle_name: profileDetails.middle_name ?? '',
      last_name: profileDetails.last_name ?? '',
    });

    const data = response.data;
    const updatedUser = data?.user ?? data?.data?.user ?? data?.data ?? data;
    if (!isObject(updatedUser)) {
      throw new Error('The server returned an invalid profile response.');
    }

    let existingUser = {};
    try {
      existingUser = JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      existingUser = {};
    }

    const mergedUser = { ...existingUser, ...updatedUser };
    localStorage.setItem('user', JSON.stringify(mergedUser));
    window.dispatchEvent(new Event('storage'));
    return mergedUser;
  } catch (error) {
    console.error('Update user error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to update your profile. Please try again.'));
  }
};

export const logoutUser = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
};

export const generateTrip = async (tripDetails) => {
  try {
    const response = await API.post('/generate-trip', tripDetails);
    return response.data;
  } catch (error) {
    console.error('Trip generation error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to generate your trip. Please try again.'));
  }
};

export const saveTrip = async (tripDetails) => {
  try {
    // Send the entire payload as-is. Never discard research results, counts,
    // the budget estimate or day-wise Markdown embedded in the saved trip.
    const payload = validateTripPayload(tripDetails);
    const response = await API.post('/trips', payload);
    return verifyTripSave(response.data, payload);
  } catch (error) {
    console.error('Save trip error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to save your trip. Please try again.'));
  }
};

export const getSavedTrips = async () => {
  try {
    const response = await API.get('/trips');
    if (!Array.isArray(response.data)) {
      throw new Error('The server returned an invalid saved-trips list.');
    }
    // Preserve all server fields; Dashboard uses the original formData.
    return response.data;
  } catch (error) {
    console.error('Get saved trips error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to load saved trips. Please try again.'));
  }
};

export const getTrip = async (tripId) => {
  try {
    const response = await API.get(`/trips/${requireId(tripId, 'Trip ID')}`);
    return validateSavedTrip(response.data, 'Open trip');
  } catch (error) {
    console.error('Get trip error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to open this trip. Please try again.'));
  }
};

export const updateTrip = async (tripId, tripDetails) => {
  try {
    const id = requireId(tripId, 'Trip ID');
    const payload = validateTripPayload(tripDetails);
    const response = await API.put(`/trips/${id}`, payload);
    return verifyTripSave(response.data, payload);
  } catch (error) {
    console.error('Update trip error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to update your trip. Please try again.'));
  }
};

export const deleteTrip = async (tripId) => {
  try {
    const response = await API.delete(`/trips/${requireId(tripId, 'Trip ID')}`);
    return response.data;
  } catch (error) {
    console.error('Delete trip error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to delete your trip. Please try again.'));
  }
};

// Both calling styles are supported:
//   regenerateTripDay({ day_number, formData, existing_itinerary, feedback })
//   regenerateTripDay(savedTripId, dayNumber, feedback, options)
// The backend only returns a one-day PREVIEW; it must not overwrite a saved
// trip until the user explicitly accepts the change through updateTrip().
export const regenerateTripDay = async (
  tripDetailsOrId,
  dayNumber,
  feedback = '',
  options = {}
) => {
  try {
    let payload;
    if (isObject(tripDetailsOrId)) {
      payload = { ...tripDetailsOrId };
      if (dayNumber !== undefined) payload.day_number = dayNumber;
      if (feedback) payload.feedback = feedback;
    } else {
      const extra = isObject(options) ? options : {};
      payload = {
        ...extra,
        ...(tripDetailsOrId != null && String(tripDetailsOrId).trim()
          ? { trip_id: String(tripDetailsOrId).trim() }
          : {}),
        day_number: dayNumber,
        feedback,
      };
    }

    const day = Number(payload.day_number);
    if (!Number.isSafeInteger(day) || day < 1) {
      throw new Error('A valid day number is required.');
    }
    payload.day_number = day;
    payload.feedback = typeof payload.feedback === 'string' ? payload.feedback : '';

    if (!payload.trip_id && !payload.thread_id && !isObject(payload.formData)) {
      throw new Error('Saved trip ID or generated trip preferences are required to regenerate a day.');
    }

    const response = await API.post('/generate-trip/regenerate-day', payload);
    // Returning a day preview is intentional; never replace the entire trip.
    return response.data;
  } catch (error) {
    console.error('Regenerate day error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to regenerate this day. Please try again.'));
  }
};

export const enableTripSharing = async (tripId) => {
  try {
    const response = await API.post(`/trips/${requireId(tripId, 'Trip ID')}/share`);
    return response.data;
  } catch (error) {
    console.error('Enable trip sharing error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to enable public sharing. Please try again.'));
  }
};

export const disableTripSharing = async (tripId) => {
  try {
    const response = await API.delete(`/trips/${requireId(tripId, 'Trip ID')}/share`);
    return response.data;
  } catch (error) {
    console.error('Disable trip sharing error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to disable public sharing. Please try again.'));
  }
};

export const getPublicTrip = async (shareToken) => {
  try {
    const response = await API.get(
      `/public/trips/${requireId(shareToken, 'Share token')}`,
      { headers: { Authorization: undefined } }
    );
    return validateSavedTrip(response.data, 'Open shared trip');
  } catch (error) {
    console.error('Get public trip error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to load this shared trip.'));
  }
};

export const getTripDayPhotos = async (tripId, dayNumber) => {
  try {
    const response = await API.get(
      `/trips/${requireId(tripId, 'Trip ID')}/day-photos/${requireId(dayNumber, 'Day number')}`
    );
    return response.data;
  } catch (error) {
    console.error('Get trip day photos error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to load photos for this day.'));
  }
};

export const getPublicTripDayPhotos = async (shareToken, dayNumber) => {
  try {
    const response = await API.get(
      `/public/trips/${requireId(shareToken, 'Share token')}/day-photos/${requireId(dayNumber, 'Day number')}`,
      { headers: { Authorization: undefined } }
    );
    return response.data;
  } catch (error) {
    console.error('Get public trip day photos error:', error.response?.data || error.message);
    throw new Error(getErrorMessage(error, 'Unable to load shared trip photos.'));
  }
};
