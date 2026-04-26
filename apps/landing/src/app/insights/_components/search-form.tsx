'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Input } from '@zivoe/ui/core/input';
import { SearchIcon } from '@zivoe/ui/icons';

const SEARCH_DEBOUNCE_MS = 300;

type InsightsSearchFormProps = {
  categorySlug?: string;
  search?: string;
};

export function InsightsSearchForm({ categorySlug, search }: InsightsSearchFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(search ?? '');
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(search ?? '');
  }, [search]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const pushSearch = (next: string) => {
    const params = new URLSearchParams();
    if (next.trim()) params.set('search', next.trim());
    if (categorySlug) params.set('category', categorySlug);
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/insights?${query}` : '/insights');
    });
  };

  const handleChange = (next: string) => {
    setValue(next);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushSearch(next), SEARCH_DEBOUNCE_MS);
  };

  return (
    <form
      action="/insights"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        pushSearch(value);
      }}
    >
      <Input
        id="search"
        name="search"
        type="search"
        variant="search"
        label="Search articles"
        labelClassName="sr-only"
        value={value}
        onChange={handleChange}
        placeholder="Search articles"
        startContent={<SearchIcon className="!size-5 shrink-0 text-icon-default" />}
        isClearable
        clearButtonAriaLabel="Clear search"
        clearButtonClassName="text-icon-default opacity-100 transition-colors hover:text-primary"
      />
      {categorySlug ? <input type="hidden" name="category" value={categorySlug} /> : null}
    </form>
  );
}
