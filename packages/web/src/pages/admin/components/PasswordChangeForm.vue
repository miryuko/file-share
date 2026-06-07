<script setup lang="ts">
/**
 * 管理员密码修改表单组件
 *
 * 职责：当前密码/新密码/确认密码输入，校验，提交，状态反馈。
 */
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

const { t } = useI18n();

const props = defineProps<{
  isDefaultPwd: boolean;
  authHeaders: Record<string, string>;
}>();

const emit = defineEmits<{
  changed: [];
}>();

const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const isChangingPassword = ref(false);

async function handleChangePassword(): Promise<void> {
  if (!newPassword.value) {
    toast.error(t("admin.passwordEmpty"));
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    toast.error(t("admin.passwordMismatch"));
    return;
  }

  isChangingPassword.value = true;

  try {
    const res = await fetch("/api/admin/password", {
      method: "PUT",
      headers: { ...props.authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      }),
    });

    if (res.status === 401) {
      emit("changed"); // Will be handled as logout trigger by parent
      return;
    }

    const body = await res.json();

    if (!res.ok) {
      toast.error(body.message || t("admin.passwordChangeFailed"));
      return;
    }

    toast.success(t("admin.passwordChanged"));
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    emit("changed");
  } catch {
    toast.error(t("admin.networkError"));
  } finally {
    isChangingPassword.value = false;
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t('admin.securitySettings') }}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div
        v-if="isDefaultPwd"
        class="rounded-lg border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning"
      >
        {{ $t('admin.defaultPasswordWarning') }}
      </div>

      <fieldset>
        <legend class="mb-3 text-sm font-semibold text-foreground">{{ $t('admin.changePassword') }}</legend>
        <div class="space-y-3 max-w-[360px]">
          <div>
            <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.currentPassword') }}</label>
            <Input v-model="currentPassword" type="password" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.newPassword') }}</label>
            <Input v-model="newPassword" type="password" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-muted-foreground">{{ $t('admin.confirmPassword') }}</label>
            <Input v-model="confirmPassword" type="password" />
          </div>
        </div>
      </fieldset>

      <div class="border-t pt-4">
        <Button @click="handleChangePassword" :disabled="isChangingPassword">
          {{ isChangingPassword ? $t('admin.changing') : $t('admin.changePassword') }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
