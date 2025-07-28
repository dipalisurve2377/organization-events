import axios from "axios";

const API_BASE_URL = "http://localhost:7001/api";

export interface Organization {
  id?: string;
  name: string;
  identifier: string;
  createdByEmail?: string;
  createdAt?: string;
  status?: string;
}

// Create organization
export const createOrganization = async (
  organization: Organization
): Promise<Organization> => {
  const response = await axios.post<Organization>(
    `${API_BASE_URL}/organizations/`,
    organization
  );
  return response.data;
};

// Get all organizations
export const getOrganizations = async (): Promise<Organization[]> => {
  const response = await axios.get<
    { organizations?: Organization[] } | Organization[]
  >(`${API_BASE_URL}/organizations`);
  return (response.data as any).organizations || response.data || [];
};

// Get single organization
export const getOrganization = async (id: string): Promise<Organization> => {
  const response = await axios.get<any>(`${API_BASE_URL}/organizations/${id}`);
  return response.data.organization || response.data;
};

// Update organization
export const updateOrganization = async (
  id: string,
  organization: Partial<Organization>
): Promise<Organization> => {
  const response = await axios.put<Organization>(
    `${API_BASE_URL}/organizations/${id}`,
    organization
  );
  return response.data;
};
