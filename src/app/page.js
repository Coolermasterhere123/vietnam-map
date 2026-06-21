import VietnamMap from '@/components/VietnamMap';

export const metadata = {
  title: 'Vietnam Closest Places',
  description: 'Find the closest saved places in Vietnam',
  manifest: '/manifest.json',
};

export default function Home() {
  return <VietnamMap />;
}
