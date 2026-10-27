async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const bodyIsFormData = options.body instanceof FormData;
  if (options.body && !bodyIsFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(
      new Error(payload?.error || `Request failed (${response.status})`),
      { status: response.status, data: payload },
    );
  }
  return payload;
}

function createEntityClient(entityName) {
  const path = `/entities/${encodeURIComponent(entityName)}`;
  return {
    list: (sort, limit) => request(`${path}${queryString({ sort, limit })}`),
    filter: (filters, sort, limit) =>
      request(`${path}${queryString({ filters: JSON.stringify(filters || {}), sort, limit })}`),
    create: (record) => request(path, { method: 'POST', body: JSON.stringify(record) }),
    bulkCreate: (records) => request(`${path}/bulk`, { method: 'POST', body: JSON.stringify(records) }),
    update: (id, patch) =>
      request(`${path}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    bulkUpdate: (records) => request(`${path}/bulk`, { method: 'PATCH', body: JSON.stringify(records) }),
    delete: (id) => request(`${path}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    subscribe: (callback) => {
      const source = new EventSource(`/api${path}/events`, { withCredentials: true });
      source.onmessage = (event) => {
        try {
          callback(JSON.parse(event.data));
        } catch (error) {
          console.error('Could not read live update', error);
        }
      };
      return () => source.close();
    },
  };
}

function queryString(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function upload(file, visibility) {
  const body = new FormData();
  body.append('file', file);
  return request(`/files?visibility=${visibility}`, { method: 'POST', body });
}

export const apiClient = {
  entities: new Proxy({}, {
    get: (_, entityName) => createEntityClient(String(entityName)),
  }),
  auth: {
    me: () => request('/auth/me'),
    logout: async () => {
      await request('/auth/logout', { method: 'POST' });
      window.location.assign('/login');
    },
    redirectToLogin: () => window.location.assign('/login'),
  },
  functions: {
    invoke: async (name, payload = {}) => ({
      data: await request(`/functions/${encodeURIComponent(name)}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    }),
  },
  integrations: {
    Core: {
      UploadFile: ({ file }) => upload(file, 'private'),
      UploadPrivateFile: ({ file }) => upload(file, 'private'),
      UploadPublicFile: ({ file }) => upload(file, 'public'),
      CreateFileSignedUrl: ({ file_uri, expires_in }) =>
        request('/files/signed-url', {
          method: 'POST',
          body: JSON.stringify({ file_uri, expires_in }),
        }),
      InvokeLLM: (payload) =>
        request('/integrations/llm', { method: 'POST', body: JSON.stringify(payload) }),
      SendEmail: (payload) =>
        request('/integrations/email', { method: 'POST', body: JSON.stringify(payload) }),
    },
  },
  users: {
    inviteUser: (email, role) =>
      request('/users/invite', { method: 'POST', body: JSON.stringify({ email, role }) }),
  },
  appLogs: {
    logUserInApp: (page) =>
      request('/activity', { method: 'POST', body: JSON.stringify({ page }) }),
  },
};

export { request as apiRequest };
