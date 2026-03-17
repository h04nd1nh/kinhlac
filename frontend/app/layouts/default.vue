<script setup lang="ts">
const { logout } = useAuth()

interface NavItem {
  icon: string
  label: string
  to: string
}

const navItems: NavItem[] = [
  { icon: 'i-lucide-home', label: 'Trang chủ', to: '/' },
  { icon: 'i-lucide-users', label: 'Bệnh nhân', to: '/patients' }
]

const route = useRoute()
const isActive = (path: string) => route.path === path
</script>

<template>
  <div class="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <!-- Logo -->
      <div class="sidebar-logo">
        <div class="logo-icon">
          <UIcon name="i-lucide-heart-pulse" class="logo-icon-svg" />
        </div>
      </div>

      <!-- Nav items -->
      <nav class="sidebar-nav">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ 'nav-item--active': isActive(item.to) }"
          :aria-label="item.label"
        >
          <UIcon :name="item.icon" class="nav-icon" />
          <span class="nav-label">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- Logout -->
      <div class="sidebar-footer">
        <button
          class="nav-item nav-item--logout"
          aria-label="Đăng xuất"
          @click="logout"
        >
          <UIcon name="i-lucide-log-out" class="nav-icon" />
          <span class="nav-label">Đăng xuất</span>
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  width: 100%;
  min-height: 100vh;
  overflow-x: hidden;
  background-color: var(--kl-bg-light, #FBF8F1);
}

/* ─── Sidebar (nâu đậm như webapp) ─── */
.sidebar {
  width: 72px;
  min-height: 100vh;
  background: var(--kl-sidebar, #3A2410);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
  transition: width 0.25s ease;
  overflow: hidden;
}

.sidebar:hover {
  width: 200px;
}

/* ─── Logo ─── */
.sidebar-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 8px 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 12px;
}

.logo-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-icon-svg {
  width: 24px;
  height: 24px;
  color: #F0E8D8;
}

/* ─── Nav ─── */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 0 10px;
  flex: 1;
}

.sidebar-footer {
  width: 100%;
  padding: 0 10px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 10px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  color: #C4B598;
  text-decoration: none;
  cursor: pointer;
  background: transparent;
  border: none;
  width: 100%;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  transform: translateX(2px);
}

.nav-item--active {
  background: var(--kl-secondary, #8B1A1A);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.nav-item--logout:hover {
  background: rgba(200, 80, 80, 0.3);
  color: #f0c0c0;
}

.nav-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ─── Main ─── */
.main-content {
  flex: 1;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 100vh;
}
</style>
