export interface Patient {
  id: number
  fullName: string
  gender: string
  dateOfBirth: string | null
  timeOfBirth: string | null
  address: string | null
  province: string | null
  phone: string | null
  medicalHistory: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreatePatientDto {
  fullName: string
  gender: string
  dateOfBirth?: string
  timeOfBirth?: string
  address?: string
  province?: string
  phone?: string
  medicalHistory?: string
  notes?: string
}

export interface PaginatedPatientsResult {
  data: Patient[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const usePatients = () => {
  const config = useRuntimeConfig()
  const { token } = useAuth()

  const baseURL = config.public.apiBase

  const authHeaders = computed(() => ({
    Authorization: `Bearer ${token.value}`
  }))

  const fetchAll = (): Promise<Patient[]> => {
    return $fetch<Patient[]>('/patients', {
      baseURL,
      headers: authHeaders.value
    })
  }

  const fetchPage = (
    page: number,
    limit: number,
    search?: string
  ): Promise<PaginatedPatientsResult> => {
    const params: Record<string, string> = { page: String(page), limit: String(limit) }
    if (search && search.trim()) params.search = search.trim()
    return $fetch<PaginatedPatientsResult>('/patients', {
      baseURL,
      headers: authHeaders.value,
      query: params
    })
  }

  const fetchOne = (id: number): Promise<Patient> => {
    return $fetch<Patient>(`/patients/${id}`, {
      baseURL,
      headers: authHeaders.value
    })
  }

  const create = (dto: CreatePatientDto): Promise<Patient> => {
    return $fetch<Patient>('/patients', {
      baseURL,
      method: 'POST',
      headers: authHeaders.value,
      body: dto
    })
  }

  const update = (id: number, dto: Partial<CreatePatientDto>): Promise<Patient> => {
    return $fetch<Patient>(`/patients/${id}`, {
      baseURL,
      method: 'PUT',
      headers: authHeaders.value,
      body: dto
    })
  }

  const remove = (id: number): Promise<void> => {
    return $fetch<void>(`/patients/${id}`, {
      baseURL,
      method: 'DELETE',
      headers: authHeaders.value
    })
  }

  return { fetchAll, fetchPage, fetchOne, create, update, remove }
}
