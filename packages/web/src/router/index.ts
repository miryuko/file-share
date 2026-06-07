import { createRouter, createWebHistory } from 'vue-router'
import SendView from '../pages/send/index.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'send',
      component: SendView,
    },
    {
      path: '/receive',
      name: 'receive',
      component: () => import('../pages/receive/index.vue'),
    },
    {
      path: '/receive/:code',
      name: 'receive-code',
      component: () => import('../pages/receive/index.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../pages/admin/index.vue'),
    },
  ],
})

export default router
