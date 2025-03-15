import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({});

export const collections = {
  blog: blogCollection,
};
