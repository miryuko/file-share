import { createRouter, createWebHistory } from 'vue-router'
import SendView from '../views/SendView.vue'

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
      // route level code-splitting
      component: () => import('../views/ReceiveView.vue'),
    },
    {
      path: '/receive/:code',
      name: 'receive-code',
      component: () => import('../views/ReceiveView.vue'),
    },
  ],
})

export default router
