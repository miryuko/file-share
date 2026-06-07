<script setup lang="ts">
/**
 * 文件拖放区域组件
 *
 * 职责：展示文件拖放/点击区域，处理拖放和点击事件，向上层 emit 选中的文件。
 *
 * 状态覆盖：
 *   - 默认：虚线边框 + 上传图标 + 提示文案
 *   - dragOver：高亮边框 + 缩放动画
 */
import { ref } from "vue";
import { Upload } from "lucide-vue-next";

defineProps<{
  limitText: string;
}>();

const emit = defineEmits<{
  files: [files: File[]];
}>();

const dragOver = ref(false);

function onDrop(event: DragEvent): void {
  dragOver.value = false;
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    emit("files", Array.from(event.dataTransfer.files));
  }
}

function triggerFileInput(): void {
  // 创建临时 input 选择文件
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.onchange = () => {
    if (input.files) {
      emit("files", Array.from(input.files));
    }
  };
  input.click();
}
</script>

<template>
  <div
    class="cursor-pointer rounded-xl border-2 border-dashed border-border px-8 py-12 text-center transition-all duration-200 hover:border-primary hover:bg-accent/50"
    :class="{ 'border-primary bg-accent/50 scale-[1.02]': dragOver }"
    @dragover.prevent="dragOver = true"
    @dragleave.prevent="dragOver = false"
    @drop.prevent="onDrop"
    @click="triggerFileInput"
  >
    <Upload class="mx-auto mb-4 text-muted-foreground" :size="48" />
    <p class="mb-2 text-lg">{{ $t("send.dropZone") }}</p>
    <p class="mb-1 text-xs text-muted-foreground">
      {{ $t("send.selectOrPaste") }}
    </p>
    <p class="text-xs text-muted-foreground">{{ limitText }}</p>
  </div>
</template>
