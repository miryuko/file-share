<script setup lang="ts">
/**
 * 管理员登录表单组件
 *
 * 职责：密码输入、登录请求、加载状态、错误提示。
 * 登录成功后 emit login-success 事件。
 */
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

const { t } = useI18n();

const emit = defineEmits<{
  "login-success": [token: string, needsPasswordChange: boolean];
}>();

const password = ref("");
const isLoading = ref(false);

async function handleLogin(): Promise<void> {
  isLoading.value = true;

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password.value }),
    });

    const body = await res.json();

    if (!res.ok) {
      if (res.status === 429) {
        toast.error(body.message || t("admin.lockedOut"));
      } else {
        toast.error(body.message || t("admin.loginFailed"));
      }
      return;
    }

    const { token, needsPasswordChange: forceChange } = body as {
      token: string;
      needsPasswordChange: boolean;
    };
    emit("login-success", token, !!forceChange);
    password.value = "";
  } catch {
    toast.error(t("admin.networkError"));
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto mt-8 max-w-[360px]">
    <div class="flex gap-3">
      <Input
        v-model="password"
        type="password"
        :placeholder="$t('admin.passwordPlaceholder')"
        class="flex-1"
        @keyup.enter="handleLogin"
      />
      <Button :disabled="!password || isLoading" @click="handleLogin">
        {{ isLoading ? $t('admin.loggingIn') : $t('admin.login') }}
      </Button>
    </div>
  </div>
</template>
