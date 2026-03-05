import { useState, useEffect } from 'react';

import axiosInstance, { endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const PAGE_SIZE = 100;

let _cache = [];
let _loaded = false;

async function loadAll() {
  if (_loaded) return _cache;
  const first = await axiosInstance
    .get(endpoints.product.list, { params: { page: 1, page_size: PAGE_SIZE } })
    .then((r) => r.data);
  let items = first.data;
  if (first.total > PAGE_SIZE) {
    const remaining = Math.ceil(first.total / PAGE_SIZE) - 1;
    const pages = await Promise.all(
      Array.from({ length: remaining }, (_, i) =>
        axiosInstance
          .get(endpoints.product.list, { params: { page: i + 2, page_size: PAGE_SIZE } })
          .then((r) => r.data.data)
      )
    );
    items = [...items, ...pages.flat()];
  }
  _cache = items;
  _loaded = true;
  return items;
}

export function useAllProducts() {
  const [products, setProducts] = useState(_cache);
  useEffect(() => {
    if (!_loaded) {
      loadAll().then(setProducts);
    }
  }, []);
  return products;
}
