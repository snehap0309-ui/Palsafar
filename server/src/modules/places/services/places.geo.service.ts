import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { getPaginationParams, paginatedResponse } from '../../../shared/utils/pagination';
import { cache, cacheKey } from '../../../config/cache';
import { mapPlaceRow, mapViewportRow, placeApproved, excludeCommercialPlacesSql, excludeCommercialPlacesWhere } from './places.helpers';
import { dedupePlacesByLocation } from '../../../shared/utils/placeDedupe';

function joinConditions(conditions: Prisma.Sql[]): Prisma.Sql {
  if (conditions.length === 0) return Prisma.sql`TRUE`;
  return conditions.reduce((acc, c) => Prisma.sql`${acc} AND ${c}`);
}

function joinOr(conditions: Prisma.Sql[]): Prisma.Sql {
  if (conditions.length === 0) return Prisma.sql`FALSE`;
  return conditions.reduce((acc, c) => Prisma.sql`${acc} OR ${c}`);
}

export const placesGeoService = {
  async search(query: {
    q?: string;
    category?: string;
    tags?: string;
    lat?: string;
    lng?: string;
    radius?: string;
    sort?: string;
    page?: string;
    limit?: string;
  }) {
    const pagination = getPaginationParams(query);
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.status = 'APPROVED'`,
      excludeCommercialPlacesSql,
    ];

    if (query.q && query.q.trim() !== '') {
      const q = query.q.trim();
      const qCollapsed = q.toLowerCase().replace(/([a-z])\1+/g, '$1');
      conditions.push(Prisma.sql`(
        p.search_vector @@ plainto_tsquery('english', ${q})
        OR p.city ILIKE ${'%' + q + '%'}
        OR p.state ILIKE ${'%' + q + '%'}
        OR p.name ILIKE ${'%' + q + '%'}
        OR regexp_replace(lower(p.name), '([a-z])\\1+', '\\1', 'g') LIKE ${'%' + qCollapsed + '%'}
      )`);
    }

    if (query.category) {
      conditions.push(Prisma.sql`LOWER(p.category) = LOWER(${query.category})`);
    }

    if (query.tags) {
      const tagList = query.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        const tagConditions = tagList.map((t) => Prisma.sql`${t} = ANY(p.tags)`);
        conditions.push(Prisma.sql`(${joinOr(tagConditions)})`);
      }
    }

    let lat = 0;
    let lng = 0;
    if (query.lat && query.lng) {
      lat = parseFloat(query.lat);
      lng = parseFloat(query.lng);
    }

    if (lat && lng) {
      const radius = parseFloat(query.radius || '50000');
      conditions.push(Prisma.sql`ST_DWithin(p.location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radius})`);
    }

    const whereClause = joinConditions(conditions);

    let orderClause: Prisma.Sql = Prisma.sql`p.created_at DESC`;
    if (query.sort === 'relevance' && query.q && query.q.trim() !== '') {
      if (query.q.trim()) {
        orderClause = Prisma.sql`ts_rank(p.search_vector, plainto_tsquery('english', ${query.q.trim()})) DESC, p.created_at DESC`;
      }
    } else if (query.sort === 'popularity') {
      orderClause = Prisma.sql`p.popularity_score DESC NULLS LAST, p.review_count DESC, p.created_at DESC`;
    } else if (query.sort === 'distance' && lat && lng) {
      orderClause = Prisma.sql`distance ASC`;
    }

    const countResult: any = await prisma.$queryRaw`SELECT COUNT(*) FROM places p WHERE ${whereClause}`;
    const total = Number(countResult[0]?.count || 0);

    const distanceSelect = lat && lng
      ? Prisma.sql`, ST_Distance(p.location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS distance`
      : Prisma.sql``;

    const rawData: any[] = await prisma.$queryRaw`
      SELECT
        p.id, p.name, p.slug, p.short_description, p.description, p.latitude, p.longitude,
        p.category, p.images, p.thumbnail, p.tags, p.city, p.state, p.country,
        p.rating, p.review_count, p.hidden_gem_score, p.popularity_score, p.verification_level,
        p.best_time_to_visit, p.best_time_reason,
        p.created_at, p.updated_at
        ${distanceSelect}
      FROM places p
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      OFFSET ${pagination.skip}
      LIMIT ${pagination.limit}
    `;

    const data = dedupePlacesByLocation(rawData.map(mapPlaceRow));

    return paginatedResponse(data, total, pagination);
  },

  async nearby(query: {
    lat: string;
    lng: string;
    radius?: string;
    category?: string;
    page?: string;
    limit?: string;
  }) {
    const pagination = getPaginationParams(query);
    const lat = parseFloat(query.lat);
    const lng = parseFloat(query.lng);
    const radius = parseFloat(query.radius || '5000');

    const ck = cacheKey('places', 'nearby', `${lat.toFixed(4)}`, `${lng.toFixed(4)}`, `${radius}`, query.category || 'all');
    const cached = await cache.get(ck);
    if (cached) {
      const { data, total } = cached as any;
      const paged = data.slice(pagination.skip, pagination.skip + pagination.limit);
      return paginatedResponse(paged, total, pagination);
    }

    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.status = 'APPROVED'`,
      excludeCommercialPlacesSql,
      Prisma.sql`ST_DWithin(p.location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radius})`,
    ];

    if (query.category) {
      conditions.push(Prisma.sql`LOWER(p.category) = LOWER(${query.category})`);
    }

    const whereClause = joinConditions(conditions);

    const countResult: any = await prisma.$queryRaw`SELECT COUNT(*) FROM places p WHERE ${whereClause}`;
    const total = Number(countResult[0]?.count || 0);
    if (total === 0) return paginatedResponse([], 0, pagination);

    const raw: any[] = await prisma.$queryRaw`
      SELECT
        p.id, p.name, p.slug, p.short_description, p.description, p.latitude, p.longitude,
        p.category, p.images, p.thumbnail, p.tags, p.city, p.state, p.country,
        p.rating, p.review_count, p.hidden_gem_score, p.popularity_score, p.verification_level,
        p.best_time_to_visit, p.best_time_reason,
        p.created_at, p.updated_at,
        ST_Distance(p.location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS distance
      FROM places p
      WHERE ${whereClause}
      ORDER BY distance ASC
    `;

    const data = dedupePlacesByLocation(raw.map(mapPlaceRow));
    const allData = { data, total: data.length };
    await cache.set(ck, allData, 120);

    const paged = data.slice(pagination.skip, pagination.skip + pagination.limit);
    return paginatedResponse(paged, data.length, pagination);
  },

  async viewport(query: {
    north: string;
    south: string;
    east: string;
    west: string;
    category?: string;
    tags?: string;
    limit?: string;
  }) {
    const north = parseFloat(query.north);
    const south = parseFloat(query.south);
    const east = parseFloat(query.east);
    const west = parseFloat(query.west);
    const limit = Math.min(parseInt(query.limit || '200', 10), 500);

    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.status = 'APPROVED'`,
      excludeCommercialPlacesSql,
      Prisma.sql`p.latitude BETWEEN ${south} AND ${north}`,
      Prisma.sql`p.longitude BETWEEN ${west} AND ${east}`,
    ];

    if (query.category) {
      conditions.push(Prisma.sql`LOWER(p.category) = LOWER(${query.category})`);
    }

    if (query.tags) {
      const tags = query.tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length > 0) {
        const tagConditions = tags.map((t) => Prisma.sql`${t} = ANY(p.tags)`);
        conditions.push(Prisma.sql`(${joinOr(tagConditions)})`);
      }
    }

    const whereClause = joinConditions(conditions);

    const raw: any[] = await prisma.$queryRaw`
      SELECT
        p.id, p.name, p.slug, p.short_description, p.latitude, p.longitude,
        p.category, p.images, p.thumbnail, p.tags, p.city, p.state, p.country,
        p.rating, p.review_count, p.hidden_gem_score, p.popularity_score, p.verification_level,
        p.best_time_to_visit, p.best_time_reason,
        p.created_at
      FROM places p
      WHERE ${whereClause}
      ORDER BY p.popularity_score DESC NULLS LAST, p.review_count DESC
      LIMIT ${limit}
    `;

    return dedupePlacesByLocation(raw.map(mapViewportRow));
  },

  async getClusters(query: {
    neLat: string;
    neLng: string;
    swLat: string;
    swLng: string;
    zoom?: string;
  }) {
    const neLat = parseFloat(query.neLat);
    const neLng = parseFloat(query.neLng);
    const swLat = parseFloat(query.swLat);
    const swLng = parseFloat(query.swLng);
    const zoom = parseInt(query.zoom || '10', 10);

    const earthWidth = 40075016.686;
    const gridSize = earthWidth / Math.pow(2, zoom + 1);

    const gridDeg = gridSize / 111320.0;
    const placesInBounds = await prisma.place.findMany({
      where: {
        status: 'APPROVED',
        ...excludeCommercialPlacesWhere,
        latitude: { not: null, gte: swLat, lte: neLat },
        longitude: { not: null, gte: swLng, lte: neLng },
      },
      select: { id: true, name: true, category: true, latitude: true, longitude: true },
    });
    const clusterMap = new Map<string, { latSum: number; lngSum: number; count: number; ids: string[]; categories: Set<string>; names: string[] }>();
    for (const p of placesInBounds) {
      const latGroup = Math.floor(p.latitude! / gridDeg);
      const lngGroup = Math.floor(p.longitude! / gridDeg);
      const key = `${latGroup}:${lngGroup}`;
      let cluster = clusterMap.get(key);
      if (!cluster) {
        cluster = { latSum: 0, lngSum: 0, count: 0, ids: [], categories: new Set(), names: [] };
        clusterMap.set(key, cluster);
      }
      cluster.latSum += p.latitude!;
      cluster.lngSum += p.longitude!;
      cluster.count += 1;
      cluster.ids.push(p.id);
      cluster.categories.add(p.category);
      cluster.names.push(p.name);
    }
    const raw = Array.from(clusterMap.entries())
      .map(([, c]) => ({
        lat: c.latSum / c.count,
        lng: c.lngSum / c.count,
        count: c.count,
        place_ids: c.ids,
        categories: Array.from(c.categories),
        names: c.names,
      }))
      .sort((a, b) => b.count - a.count);

    return raw.map((r: any) => ({
      latitude: Number(r.lat),
      longitude: Number(r.lng),
      count: Number(r.count),
      placeIds: r.place_ids,
      categories: r.categories,
      label: Number(r.count) === 1 ? r.names[0] : `${r.count} places`,
    }));
  },

  async viewportSearch(query: {
    q?: string;
    north: string;
    south: string;
    east: string;
    west: string;
    category?: string;
    limit?: string;
  }) {
    const north = parseFloat(query.north);
    const south = parseFloat(query.south);
    const east = parseFloat(query.east);
    const west = parseFloat(query.west);
    const limit = Math.min(parseInt(query.limit || '200', 10), 500);

    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.status = 'APPROVED'`,
      excludeCommercialPlacesSql,
      Prisma.sql`p.location && ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)`,
      Prisma.sql`ST_Within(p.location, ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326))`,
    ];

    if (query.q && query.q.trim() !== '') {
      const q = query.q.trim();
      const qCollapsed = q.toLowerCase().replace(/([a-z])\1+/g, '$1');
      conditions.push(Prisma.sql`(
        p.search_vector @@ plainto_tsquery('english', ${q})
        OR p.city ILIKE ${'%' + q + '%'}
        OR p.state ILIKE ${'%' + q + '%'}
        OR p.name ILIKE ${'%' + q + '%'}
        OR regexp_replace(lower(p.name), '([a-z])\\1+', '\\1', 'g') LIKE ${'%' + qCollapsed + '%'}
      )`);
    }

    if (query.category) {
      conditions.push(Prisma.sql`LOWER(p.category) = LOWER(${query.category})`);
    }

    const whereClause = joinConditions(conditions);

    const raw: any[] = await prisma.$queryRaw`
      SELECT
        p.id, p.name, p.slug, p.short_description, p.latitude, p.longitude,
        p.category, p.images, p.thumbnail, p.tags, p.city, p.state, p.country,
        p.rating, p.review_count, p.hidden_gem_score, p.popularity_score, p.verification_level,
        p.best_time_to_visit, p.best_time_reason,
        p.created_at
      FROM places p
      WHERE ${whereClause}
      ORDER BY p.popularity_score DESC NULLS LAST, p.review_count DESC
      LIMIT ${limit}
    `;

    return dedupePlacesByLocation(raw.map(mapViewportRow));
  },

  async getTrending(limit: number = 20) {
    const ck = cacheKey('places', 'trending');
    const cached = await cache.get<any[]>(ck);
    if (cached) return cached;

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    const raw: any[] = await prisma.$queryRaw`
      SELECT
        p.id, p.name, p.slug, p.short_description, p.latitude, p.longitude,
        p.category, p.images, p.thumbnail, p.tags, p.city, p.state, p.country,
        p.rating, p.review_count, p.popularity_score,
        p.best_time_to_visit, p.best_time_reason, p.created_at,
        COUNT(ps.id) AS engagement
      FROM places p
      LEFT JOIN place_stats ps ON ps."placeId" = p.id AND ps.created_at >= ${sevenDaysAgo}
      WHERE p.status = ${placeApproved}
        AND p.category::text NOT IN ('SHOPPING', 'RESTAURANT', 'HOTEL')
      GROUP BY p.id
      ORDER BY engagement DESC
      LIMIT ${limit}
    `;

    const result = dedupePlacesByLocation(
      raw.map((r: any) => ({
        ...mapViewportRow(r),
        engagement: Number(r.engagement),
      })),
    );

    await cache.set(ck, result, 300);
    return result;
  },

  async getHiddenGems(limit: number = 20) {
    const ck = cacheKey('places', 'hidden-gems');
    const cached = await cache.get<any[]>(ck);
    if (cached) return cached;

    const raw: any[] = await prisma.$queryRaw`
      SELECT
        p.id, p.name, p.slug, p.short_description, p.latitude, p.longitude,
        p.category, p.images, p.thumbnail, p.tags, p.city, p.state, p.country,
        p.rating, p.review_count, p.hidden_gem_score, p.popularity_score,
        p.best_time_to_visit, p.best_time_reason, p.created_at,
        COUNT(ps.id) FILTER (WHERE ps.action = 'view') AS views,
        COUNT(ps.id) FILTER (WHERE ps.action = 'like') AS likes
      FROM places p
      LEFT JOIN place_stats ps ON ps."placeId" = p.id
      WHERE p.status = ${placeApproved}
        AND p.category::text NOT IN ('SHOPPING', 'RESTAURANT', 'HOTEL')
      GROUP BY p.id
      HAVING COUNT(ps.id) FILTER (WHERE ps.action = 'view') BETWEEN 10 AND 200
        AND COUNT(ps.id) FILTER (WHERE ps.action = 'like') > 0
      ORDER BY
        CAST(COUNT(ps.id) FILTER (WHERE ps.action = 'like') AS FLOAT) /
        NULLIF(COUNT(ps.id) FILTER (WHERE ps.action = 'view'), 0) DESC,
        p.created_at DESC
      LIMIT ${limit}
    `;

    const result = dedupePlacesByLocation(
      raw.map((r: any) => ({
        ...mapViewportRow(r),
        views: Number(r.views),
        likes: Number(r.likes),
        likeRatio: Number(r.views) > 0
          ? Number(((Number(r.likes) / Number(r.views)) * 100).toFixed(1))
          : 0,
      })),
    );

    await cache.set(ck, result, 300);
    return result;
  },

  async getHotspots(query: {
    days?: string;
    minEngagement?: string;
    limit?: string;
  }) {
    const days = parseInt(query.days || '30', 10);
    const minEngagement = parseInt(query.minEngagement || '10', 10);
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const since = new Date(Date.now() - days * 86400000);

    const raw: any[] = await prisma.$queryRaw`
      SELECT
        p.id, p.name, p.slug, p.latitude, p.longitude,
        p.category, p.city, p.state, p.popularity_score, p.hidden_gem_score,
        COUNT(ps.id) AS total_engagement,
        COUNT(ps.id) FILTER (WHERE ps.action = 'view') AS views,
        COUNT(ps.id) FILTER (WHERE ps.action = 'like') AS likes,
        COUNT(ps.id) FILTER (WHERE ps.action = 'save') AS saves,
        COUNT(ps.id) FILTER (WHERE ps.action = 'checkin') AS checkins
      FROM places p
      JOIN place_stats ps ON ps."placeId" = p.id
      WHERE p.status = ${placeApproved}
        AND p.category::text NOT IN ('SHOPPING', 'RESTAURANT', 'HOTEL')
        AND ps.created_at >= ${since}
      GROUP BY p.id
      HAVING COUNT(ps.id) >= ${minEngagement}
      ORDER BY total_engagement DESC
      LIMIT ${limit}
    `;

    return raw.map((r: any) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      category: r.category,
      city: r.city,
      state: r.state,
      popularityScore: r.popularity_score ? Number(r.popularity_score) : null,
      hiddenGemScore: r.hidden_gem_score ? Number(r.hidden_gem_score) : null,
      engagement: {
        total: Number(r.total_engagement),
        views: Number(r.views),
        likes: Number(r.likes),
        saves: Number(r.saves),
        checkins: Number(r.checkins),
      },
    }));
  },

  async getNearbyVendors(placeId: string, query: { radius?: string; limit?: string; category?: string }) {
    const place = await prisma.place.findUnique({ where: { id: placeId } });
    if (!place) throw new Error('Place not found');

    const radius = parseFloat(query.radius || '5000');
    const limit = parseInt(query.limit || '10');
    const categoryCondition = query.category ? Prisma.sql`AND v.category = ${query.category}` : Prisma.empty;

    const vendors = await prisma.$queryRaw<any[]>`
      SELECT v.id, v.business_name as "businessName", v.category, v.rating,
             v.latitude, v.longitude, v.thumbnail_url as "thumbnailUrl",
             ST_Distance(
               v.location::geography,
               ST_SetSRID(ST_MakePoint(${place.longitude}, ${place.latitude}), 4326)::geography
             ) as distance
      FROM vendors v
      WHERE v.status = 'APPROVED'
        AND ST_DWithin(
          v.location::geography,
          ST_SetSRID(ST_MakePoint(${place.longitude}, ${place.latitude}), 4326)::geography,
          ${radius}
        )
        ${categoryCondition}
      ORDER BY distance ASC
      LIMIT ${limit}
    `;
    return vendors;
  },
};
