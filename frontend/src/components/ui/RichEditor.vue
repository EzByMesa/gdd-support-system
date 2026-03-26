<template>
  <div class="rich-editor">
    <!-- Toolbar -->
    <div v-if="editor" class="rich-editor__toolbar">
      <v-btn-group density="compact" variant="text">
        <v-btn size="small" :color="editor.isActive('bold') ? 'primary' : ''"
          @click="editor.chain().focus().toggleBold().run()">
          <v-icon size="18">mdi-format-bold</v-icon>
        </v-btn>
        <v-btn size="small" :color="editor.isActive('italic') ? 'primary' : ''"
          @click="editor.chain().focus().toggleItalic().run()">
          <v-icon size="18">mdi-format-italic</v-icon>
        </v-btn>
        <v-btn size="small" :color="editor.isActive('strike') ? 'primary' : ''"
          @click="editor.chain().focus().toggleStrike().run()">
          <v-icon size="18">mdi-format-strikethrough</v-icon>
        </v-btn>
      </v-btn-group>

      <v-divider vertical class="mx-1" />

      <v-btn-group density="compact" variant="text">
        <v-btn size="small" :color="editor.isActive('heading', { level: 2 }) ? 'primary' : ''"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">
          <v-icon size="18">mdi-format-header-2</v-icon>
        </v-btn>
        <v-btn size="small" :color="editor.isActive('heading', { level: 3 }) ? 'primary' : ''"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">
          <v-icon size="18">mdi-format-header-3</v-icon>
        </v-btn>
      </v-btn-group>

      <v-divider vertical class="mx-1" />

      <v-btn-group density="compact" variant="text">
        <v-btn size="small" :color="editor.isActive('bulletList') ? 'primary' : ''"
          @click="editor.chain().focus().toggleBulletList().run()">
          <v-icon size="18">mdi-format-list-bulleted</v-icon>
        </v-btn>
        <v-btn size="small" :color="editor.isActive('orderedList') ? 'primary' : ''"
          @click="editor.chain().focus().toggleOrderedList().run()">
          <v-icon size="18">mdi-format-list-numbered</v-icon>
        </v-btn>
        <v-btn size="small" :color="editor.isActive('blockquote') ? 'primary' : ''"
          @click="editor.chain().focus().toggleBlockquote().run()">
          <v-icon size="18">mdi-format-quote-close</v-icon>
        </v-btn>
      </v-btn-group>

      <v-divider vertical class="mx-1" />

      <v-btn-group density="compact" variant="text">
        <v-btn size="small" @click="addImage" title="Вставить изображение">
          <v-icon size="18">mdi-image-plus</v-icon>
        </v-btn>
        <v-btn size="small" @click="addLink" title="Вставить ссылку">
          <v-icon size="18">mdi-link</v-icon>
        </v-btn>
      </v-btn-group>

      <v-divider vertical class="mx-1" />

      <v-btn-group density="compact" variant="text">
        <v-btn size="small" @click="editor.chain().focus().undo().run()" :disabled="!editor.can().undo()">
          <v-icon size="18">mdi-undo</v-icon>
        </v-btn>
        <v-btn size="small" @click="editor.chain().focus().redo().run()" :disabled="!editor.can().redo()">
          <v-icon size="18">mdi-redo</v-icon>
        </v-btn>
      </v-btn-group>
    </div>

    <!-- Editor -->
    <editor-content :editor="editor" class="rich-editor__content" />

    <!-- Hidden file input for image upload -->
    <input ref="fileInput" type="file" accept="image/*" hidden @change="handleImageUpload" />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { api } from '@/services/api.js';

const props = defineProps({
  modelValue: { type: String, default: '' }
});
const emit = defineEmits(['update:modelValue']);

const fileInput = ref(null);

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Image.configure({ inline: false, allowBase64: true }),
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: 'Начните писать...' })
  ],
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML());
  }
});

watch(() => props.modelValue, (val) => {
  if (editor.value && val !== editor.value.getHTML()) {
    editor.value.commands.setContent(val, false);
  }
});

function addImage() {
  fileInput.value?.click();
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Загружаем через API как вложение
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.upload('/attachments', fd);
    const url = `/api/attachments/${res.data.id}/download`;
    editor.value.chain().focus().setImage({ src: url }).run();
  } catch {
    // Fallback: base64
    const reader = new FileReader();
    reader.onload = () => {
      editor.value.chain().focus().setImage({ src: reader.result }).run();
    };
    reader.readAsDataURL(file);
  }
  event.target.value = '';
}

function addLink() {
  const url = prompt('URL ссылки:');
  if (url) {
    editor.value.chain().focus().setLink({ href: url }).run();
  }
}

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<style>
.rich-editor {
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  overflow: hidden;
}

.rich-editor__toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  gap: 2px;
}

.rich-editor__content .tiptap {
  padding: 12px 16px;
  min-height: 200px;
  max-height: 50vh;
  overflow-y: auto;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
}

.rich-editor__content .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: rgba(255, 255, 255, 0.25);
  pointer-events: none;
  height: 0;
}

.rich-editor__content .tiptap h2 { font-size: 1.4em; font-weight: 600; margin: 16px 0 8px; }
.rich-editor__content .tiptap h3 { font-size: 1.2em; font-weight: 600; margin: 12px 0 6px; }
.rich-editor__content .tiptap p { margin: 6px 0; }
.rich-editor__content .tiptap ul, .rich-editor__content .tiptap ol { padding-left: 20px; }
.rich-editor__content .tiptap blockquote {
  border-left: 3px solid rgba(255, 255, 255, 0.2);
  padding-left: 12px;
  margin: 8px 0;
  opacity: 0.7;
}
.rich-editor__content .tiptap img {
  max-width: 100%;
  border-radius: 8px;
  margin: 8px 0;
}
.rich-editor__content .tiptap a { color: #8B9DC3; }
</style>
