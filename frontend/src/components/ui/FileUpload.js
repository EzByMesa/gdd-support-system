import { el } from '../../utils/dom.js';
import { formatFileSize } from '../../utils/format.js';

export class FileUpload {
  /**
   * @param {object} opts
   * @param {boolean} opts.multiple
   * @param {string} opts.accept - напр. 'image/*,.pdf'
   * @param {Function} opts.onChange - вызывается с File[]
   */
  constructor({ multiple = true, accept, onChange } = {}) {
    this.files = [];
    this.onChange = onChange;

    this.input = el('input', {
      type: 'file',
      style: { display: 'none' }
    });
    if (multiple) this.input.multiple = true;
    if (accept) this.input.accept = accept;
    this.input.addEventListener('change', () => this._onFiles(this.input.files));

    this.dropzone = el('div', { class: 'file-upload' }, [
      el('div', { class: 'file-upload__text' }, [
        el('span', {}, 'Нажмите'),
        ' или перетащите файлы сюда'
      ])
    ]);

    this.dropzone.addEventListener('click', () => this.input.click());
    this.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropzone.classList.add('file-upload--dragover');
    });
    this.dropzone.addEventListener('dragleave', () => {
      this.dropzone.classList.remove('file-upload--dragover');
    });
    this.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropzone.classList.remove('file-upload--dragover');
      this._onFiles(e.dataTransfer.files);
    });

    this.fileList = el('div', { class: 'flex-col gap-xs mt-sm' });

    this.el = el('div', {}, [this.input, this.dropzone, this.fileList]);
  }

  _onFiles(fileListObj) {
    const newFiles = Array.from(fileListObj);
    this.files.push(...newFiles);
    this._renderList();
    if (this.onChange) this.onChange(this.files);
  }

  _renderList() {
    this.fileList.innerHTML = '';
    this.files.forEach((file, i) => {
      const item = el('div', { class: 'flex items-center justify-between gap-sm', style: { fontSize: 'var(--font-size-sm)' } }, [
        el('span', {}, `${file.name} (${formatFileSize(file.size)})`),
        el('button', {
          class: 'btn btn--ghost btn--sm',
          onClick: () => {
            this.files.splice(i, 1);
            this._renderList();
            if (this.onChange) this.onChange(this.files);
          }
        }, '\u00D7')
      ]);
      this.fileList.appendChild(item);
    });
  }

  getFiles() {
    return this.files;
  }

  clear() {
    this.files = [];
    this.fileList.innerHTML = '';
    this.input.value = '';
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }
}
