import React, { useState, useEffect } from 'react';
import { Users, MousePointerClick, TrendingUp, Camera as CameraIcon, Activity, Package } from 'lucide-react';
import { KPICard } from '../components/widgets/KPICard';
import { EventStream } from '../components/widgets/EventStream';
import { LiveCameraCard } from '../components/widgets/LiveCameraCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ customers: 0, interactions: 0, conversion: 0, cameras: 0 });
  const [events, setEvents] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [chartData, setChartData] = useState([]);

  const loadDashboardData = async () => {
    try {
      const [analyticsRes, camerasRes, eventsRes, productsRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/cameras'),
        fetch('/api/events'),
        fetch('/api/products')
      ]);

      let camCount = 0;
      let camList = [];
      if (camerasRes.ok) {
        camList = await camerasRes.json();
        setCameras(camList);
        camCount = camList.length;
      }

      let evList = [];
      if (eventsRes.ok) {
        evList = await eventsRes.json();
        setEvents(evList);
      }

      let prodList = [];
      if (productsRes.ok) {
        prodList = await productsRes.json();
      }

      if (analyticsRes.ok) {
        const a = await analyticsRes.json();
        setStats({
          customers: a.active_customers_now ?? 0,
          interactions: a.total_interactions ?? 0,
          conversion: a.conversion_rate_pct ?? 0,
          cameras: camCount
        });

        // Top products from real analytics or products
        if (a.product_stats && a.product_stats.length > 0) {
          setTopProducts(a.product_stats.map(p => ({
            name: p.product_name,
            interactions: p.pickups || 0
          })));
        } else if (prodList.length > 0) {
          setTopProducts(prodList.slice(0, 5).map(p => ({
            name: p.name,
            interactions: 0
          })));
        } else {
          setTopProducts([]);
        }
      } else {
        setStats({ customers: 0, interactions: 0, conversion: 0, cameras: camCount });
      }

      // Compute chart data if real events exist
      if (evList.length > 0) {
        const hourMap = {};
        evList.forEach(e => {
          if (e.timestamp) {
            const h = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            hourMap[h] = (hourMap[h] || 0) + 1;
          }
        });
        const points = Object.entries(hourMap).map(([time, count]) => ({ time, interactions: count }));
        setChartData(points);
      } else {
        setChartData([]);
      }

    } catch (err) {
      console.error('Failed to load real dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const timer = setInterval(loadDashboardData, 5000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-[140px] w-full rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 min-w-0">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <KPICard title="Active Customers" value={stats.customers} icon={Users} />
        <KPICard title="Total Interactions" value={stats.interactions} icon={MousePointerClick} />
        <KPICard title="Conversion Rate" value={`${stats.conversion}%`} icon={TrendingUp} />
        <KPICard title="Active Cameras" value={stats.cameras} icon={CameraIcon} />
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <Card className="flex flex-col h-full border bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-foreground font-bold text-base">Live Camera Feeds</CardTitle>
              <CardDescription className="text-muted-foreground text-xs">Real-time inference feeds from connected cameras</CardDescription>
            </div>
            <a href="/cameras" className="text-xs font-semibold text-primary hover:underline">View All →</a>
          </CardHeader>
          <CardContent className="flex-1 pt-2">
            {cameras.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cameras.slice(0, 4).map(cam => (
                  <LiveCameraCard 
                    key={cam.id} 
                    camera={cam}
                    cameraId={cam.id}
                    name={cam.name} 
                    zone={cam.zone || 'Shelf Zone'} 
                    status={cam.status || 'OFFLINE'} 
                    resolution={cam.resolution}
                    fps={cam.fps}
                    quality_preset={cam.quality_preset}
                    lens={cam.lens}
                  />
                ))}
              </div>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 text-center">
                <CameraIcon className="w-10 h-10 text-primary/70 mb-3" />
                <p className="font-semibold text-foreground text-sm">No cameras connected</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Go to the Cameras page to connect your webcam or mobile phone camera.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-foreground font-bold text-base">Recent Events</CardTitle>
              <CardDescription className="text-muted-foreground text-xs">Live stream of detected interactions</CardDescription>
            </div>
            <a href="/events" className="text-xs font-semibold text-primary hover:underline">View Log →</a>
          </CardHeader>
          <CardContent className="pt-2">
            <EventStream events={events} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border bg-card shadow-xs">
          <CardHeader>
            <CardTitle className="text-foreground font-bold text-base">Interaction Volume</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">Hourly customer activity and engagement volume</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area type="monotone" dataKey="interactions" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorInt)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-6 text-center">
                <Activity className="w-10 h-10 text-primary/70 mb-3" />
                <p className="font-semibold text-foreground text-sm">No volume data yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Activity graphs will plot automatically as shoppers interact with products.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-xs">
          <CardHeader>
            <CardTitle className="text-foreground font-bold text-base">Top Products</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">Most engaged products by interaction frequency</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <RechartsTooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="interactions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-6 text-center">
                <Package className="w-10 h-10 text-primary/70 mb-3" />
                <p className="font-semibold text-foreground text-sm">No registered products yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Register products with live camera photos to start tracking interactions.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
