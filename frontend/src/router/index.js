import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';

const routes = [
  // Public
  {
    path: '/setup',
    name: 'setup',
    component: () => import('@/pages/SetupWizardPage.vue'),
    meta: { guest: true }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { guest: true }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/pages/RegisterPage.vue'),
    meta: { guest: true }
  },

  // Tickets (all authenticated)
  {
    path: '/',
    name: 'tickets',
    component: () => import('@/pages/TicketsPage.vue'),
    meta: { roles: ['USER', 'AGENT', 'ADMIN'] }
  },
  {
    path: '/tickets/new',
    name: 'new-ticket',
    component: () => import('@/pages/NewTicketPage.vue'),
    meta: { roles: ['USER', 'AGENT', 'ADMIN'] }
  },
  {
    path: '/tickets/:id',
    name: 'ticket-detail',
    component: () => import('@/pages/TicketDetailPage.vue'),
    meta: { roles: ['USER', 'AGENT', 'ADMIN'] }
  },

  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/pages/ProfilePage.vue'),
    meta: { roles: ['USER', 'AGENT', 'ADMIN'] }
  },

  // Agent
  {
    path: '/delegations',
    name: 'delegations',
    component: () => import('@/pages/DelegationsPage.vue'),
    meta: { roles: ['AGENT', 'ADMIN'] }
  },
  {
    path: '/topic-groups',
    name: 'topic-groups',
    component: () => import('@/pages/TopicGroupsPage.vue'),
    meta: { roles: ['AGENT', 'ADMIN'] }
  },

  // Admin
  {
    path: '/admin',
    redirect: '/admin/dashboard'
  },
  {
    path: '/admin/dashboard',
    name: 'admin-dashboard',
    component: () => import('@/pages/admin/AdminDashboardPage.vue'),
    meta: { roles: ['ADMIN'], admin: true }
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('@/pages/admin/AdminUsersPage.vue'),
    meta: { roles: ['ADMIN'], admin: true }
  },
  {
    path: '/admin/tickets',
    name: 'admin-tickets',
    component: () => import('@/pages/admin/AdminTicketsPage.vue'),
    meta: { roles: ['ADMIN'], admin: true }
  },
  {
    path: '/admin/topic-groups',
    name: 'admin-topic-groups',
    component: () => import('@/pages/admin/AdminTopicGroupsPage.vue'),
    meta: { roles: ['ADMIN'], admin: true }
  },
  {
    path: '/admin/auth',
    name: 'admin-auth',
    component: () => import('@/pages/admin/AdminAuthPage.vue'),
    meta: { roles: ['ADMIN'], admin: true }
  },
  {
    path: '/admin/custom-fields',
    name: 'admin-custom-fields',
    component: () => import('@/pages/admin/AdminCustomFieldsPage.vue'),
    meta: { roles: ['ADMIN'], admin: true }
  },
  {
    path: '/admin/settings',
    name: 'admin-settings',
    component: () => import('@/pages/admin/AdminSettingsPage.vue'),
    meta: { roles: ['ADMIN'], admin: true }
  },

  // 404
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue')
  }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});

/**
 * Router guard: если user = null, пытаемся восстановить сессию
 * через refresh token ПЕРЕД редиректом на login.
 */
router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  // Guest-only pages — всегда пропускаем
  if (to.meta.guest) {
    return true;
  }

  // Protected routes
  if (to.meta.roles) {
    // Если нет авторизации — пробуем восстановить через refresh cookie
    if (!authStore.isAuthenticated) {
      await authStore.tryRestore();
    }

    // Если всё ещё не авторизован — на логин
    if (!authStore.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }

    // Проверка роли
    if (!to.meta.roles.includes(authStore.user.role)) {
      return { name: 'tickets' };
    }
  }

  return true;
});
