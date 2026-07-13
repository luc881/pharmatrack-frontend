import useSWR from 'swr';
import { useMemo } from 'react';

import axiosInstance, { fetcher, endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ponytail: catálogos completos con page_size=100 (mismo patrón que useAllIngredients);
// paginar cuando la taxonomía pase de 100 registros
const ALL = { page: 1, page_size: 100 };

// ----------------------------------------------------------------------

// Árbol completo de grupos (anidado vía children)
export function useAnimalGroupTree() {
  const { data, isLoading, mutate } = useSWR(endpoints.animalGroup.tree, fetcher, swrOptions);
  return useMemo(
    () => ({ groupTree: data ?? [], groupTreeLoading: isLoading, groupTreeMutate: mutate }),
    [data, isLoading, mutate]
  );
}

export function useAllGenera() {
  const url = [endpoints.genus.list, { params: ALL }];
  const { data, isLoading, mutate } = useSWR(url, fetcher, swrOptions);
  return useMemo(
    () => ({ genera: data?.data ?? [], generaLoading: isLoading, generaMutate: mutate }),
    [data, isLoading, mutate]
  );
}

export function useAllSpecies(genusId) {
  const url = [endpoints.species.list, { params: { ...ALL, ...(genusId ? { genus_id: genusId } : {}) } }];
  const { data, isLoading, mutate } = useSWR(url, fetcher, swrOptions);
  return useMemo(
    () => ({ species: data?.data ?? [], speciesLoading: isLoading, speciesMutate: mutate }),
    [data, isLoading, mutate]
  );
}

export function useAllMorphs(speciesId) {
  const url = [endpoints.morph.list, { params: { ...ALL, ...(speciesId ? { species_id: speciesId } : {}) } }];
  const { data, isLoading, mutate } = useSWR(url, fetcher, swrOptions);
  return useMemo(
    () => ({ morphs: data?.data ?? [], morphsLoading: isLoading, morphsMutate: mutate }),
    [data, isLoading, mutate]
  );
}

// ----------------------------------------------------------------------

export function useGetAnimals({ page = 1, pageSize = 10, speciesId, genusId, status, groupId } = {}) {
  const params = {
    page,
    page_size: pageSize,
    ...(speciesId ? { species_id: speciesId } : {}),
    ...(genusId ? { genus_id: genusId } : {}),
    ...(status ? { status } : {}),
    // group_id incluye todo el subárbol del grupo
    ...(groupId ? { group_id: groupId } : {}),
  };
  const url = [endpoints.animal.list, { params }];

  const { data, isLoading, error, isValidating, mutate } = useSWR(url, fetcher, {
    ...swrOptions,
    keepPreviousData: true,
  });

  return useMemo(
    () => ({
      animals: data?.data ?? [],
      animalsTotal: data?.total ?? 0,
      animalsLoading: isLoading || isValidating,
      animalsError: error,
      animalsMutate: mutate,
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

export function useGetAnimal(animalId) {
  const url = animalId ? endpoints.animal.details(animalId) : null;
  const { data, isLoading, error } = useSWR(url, fetcher, swrOptions);

  return useMemo(
    () => ({ animal: data ?? null, animalLoading: isLoading, animalError: error }),
    [data, error, isLoading]
  );
}

// ----------------------------------------------------------------------

export const createAnimalGroup = (data) => axiosInstance.post(endpoints.animalGroup.create, data).then((r) => r.data);
export const updateAnimalGroup = (id, data) => axiosInstance.put(endpoints.animalGroup.update(id), data).then((r) => r.data);
export const deleteAnimalGroup = (id) => axiosInstance.delete(endpoints.animalGroup.delete(id)).then((r) => r.data);

export const createGenus = (data) => axiosInstance.post(endpoints.genus.create, data).then((r) => r.data);
export const updateGenus = (id, data) => axiosInstance.put(endpoints.genus.update(id), data).then((r) => r.data);
export const deleteGenus = (id) => axiosInstance.delete(endpoints.genus.delete(id)).then((r) => r.data);

export const createSpecies = (data) => axiosInstance.post(endpoints.species.create, data).then((r) => r.data);
export const updateSpecies = (id, data) => axiosInstance.put(endpoints.species.update(id), data).then((r) => r.data);
export const deleteSpecies = (id) => axiosInstance.delete(endpoints.species.delete(id)).then((r) => r.data);

export const createMorph = (data) => axiosInstance.post(endpoints.morph.create, data).then((r) => r.data);
export const updateMorph = (id, data) => axiosInstance.put(endpoints.morph.update(id), data).then((r) => r.data);
export const deleteMorph = (id) => axiosInstance.delete(endpoints.morph.delete(id)).then((r) => r.data);

export const createAnimal = (data) => axiosInstance.post(endpoints.animal.create, data).then((r) => r.data);
export const updateAnimal = (id, data) => axiosInstance.put(endpoints.animal.update(id), data).then((r) => r.data);
export const deleteAnimal = (id) => axiosInstance.delete(endpoints.animal.delete(id)).then((r) => r.data);
