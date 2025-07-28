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
