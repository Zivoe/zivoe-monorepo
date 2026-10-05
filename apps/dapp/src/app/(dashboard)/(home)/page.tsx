import { verifyOnboarded } from '@/server/data/auth';

import HomeView from '../_zivoe-vaults/home-view';
import { getHomepageNav } from '../_zivoe-vaults/homepage-nav';

export default async function HomePage() {
  const [nav] = await Promise.all([getHomepageNav(), verifyOnboarded()]);

  return <HomeView nav={nav} />;
}
