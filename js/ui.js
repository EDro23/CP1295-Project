/**
 * ui.js - UI management and event handlers
 * Functions for handling the user interface elements and interactions
 */

import { createNote } from './notes.js';
import { saveNotes, exportNotesAsJson } from './storage.js';

/**
 * Initialize UI event listeners
 * @param {NoteManager} noteManager - The note manager instance
 */
export function initializeUI(noteManager) {
    const noteBoard = document.getElementById('note-board');
    const exportBtn = document.getElementById('export-btn');
    const sortAscBtn = document.getElementById('sort-asc-btn');
    const sortDescBtn = document.getElementById('sort-desc-btn');

    noteBoard.addEventListener('dblclick', (event) => {
        if (event.target === noteBoard) {
            createNewNote(event.clientX, event.clientY, noteManager);
        }
    });

    exportBtn.addEventListener('click', () => {
        exportNotes(noteManager);
    });

    sortAscBtn.addEventListener('click', () => {
        sortNotesByTimestamp(noteManager, 'asc');
    });

    sortDescBtn.addEventListener('click', () => {
        sortNotesByTimestamp(noteManager, 'desc');
    });

    setupAutoSave(noteManager);
}

/**
 * Create a new note at the specified position
 */
export function createNewNote(x, y, noteManager) {
    const noteBoard = document.getElementById('note-board');
    const boardRect = noteBoard.getBoundingClientRect();

    const boardX = x - boardRect.left;
    const boardY = y - boardRect.top;
    const createdAt = new Date().toISOString();

    const note = createNote({
        content: '',
        x: boardX,
        y: boardY,
        createdAt,
        imageData: ''
    });

    noteManager.addNote(note);
    const noteElement = note.createElement();
    setupNoteEventListeners(noteElement, note, noteManager);
    noteBoard.appendChild(noteElement);

    const contentElement = noteElement.querySelector('.note-content');
    contentElement.focus();

    renderTimestamp(noteElement, createdAt);
    return note;
}

/**
 * Set up event listeners for a note element
 */
export function setupNoteEventListeners(noteElement, note, noteManager) {
    const contentElement = noteElement.querySelector('.note-content');
    const deleteButton = noteElement.querySelector('.delete-btn');
    const quoteButton = noteElement.querySelector('.quote-btn');
    const imageUploadBtn = noteElement.querySelector('.image-upload-btn');
    const imageInput = noteElement.querySelector('.image-input');
    const imagePreview = noteElement.querySelector('.note-image');

    let isDragging = false;
    let dragOffsetX, dragOffsetY;

    // Load image if available
    if (note.imageData) {
        imagePreview.src = note.imageData;
        imagePreview.style.display = 'block';
    } else {
        imagePreview.style.display = 'none';
    }

    // Load timestamp if available
    if (note.createdAt) {
        renderTimestamp(noteElement, note.createdAt);
    }

    contentElement.addEventListener('input', () => {
        note.updateContent(contentElement.textContent);
    });

    deleteButton.addEventListener('click', () => {
        deleteNote(noteElement, note, noteManager);
    });

    quoteButton.addEventListener('click', async () => {
        try {
            quoteButton.textContent = '⌛';
            await note.addRandomQuote();
            quoteButton.textContent = '💡';
        } catch (error) {
            quoteButton.textContent = '❌';
            setTimeout(() => { quoteButton.textContent = '💡'; }, 1500);
            console.error('Failed to fetch quote:', error);
        }
    });

    imageUploadBtn.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                imagePreview.src = dataUrl;
                imagePreview.style.display = 'block';
                note.imageData = dataUrl;
            };
            reader.readAsDataURL(file);
        }
    });

    noteElement.addEventListener('mousedown', (event) => {
        if ([deleteButton, quoteButton, contentElement, imageUploadBtn, imageInput, imagePreview].includes(event.target)) {
            return;
        }

        isDragging = true;
        const noteRect = noteElement.getBoundingClientRect();
        dragOffsetX = event.clientX - noteRect.left;
        dragOffsetY = event.clientY - noteRect.top;
        noteElement.classList.add('note-active');
        event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
        if (!isDragging) return;

        const noteBoard = document.getElementById('note-board');
        const boardRect = noteBoard.getBoundingClientRect();

        let newX = event.clientX - boardRect.left - dragOffsetX;
        let newY = event.clientY - boardRect.top - dragOffsetY;

        newX = Math.max(0, Math.min(newX, boardRect.width - noteElement.offsetWidth));
        newY = Math.max(0, Math.min(newY, boardRect.height - noteElement.offsetHeight));

        note.updatePosition(newX, newY);
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            noteElement.classList.remove('note-active');
        }
    });
}

/**
 * Delete a note
 */
export function deleteNote(noteElement, note, noteManager) {
    noteElement.classList.add('note-fade-out');
    noteElement.addEventListener('animationend', () => {
        noteElement.remove();
        noteManager.removeNote(note.id);
    });
}

/**
 * Export all notes as JSON file
 */
export function exportNotes(noteManager) {
    const notes = noteManager.toJSON();
    exportNotesAsJson(notes);
}

/**
 * Setup auto-save functionality
 */
export function setupAutoSave(noteManager) {
    setInterval(() => {
        const notes = noteManager.toJSON();
        saveNotes(notes);
    }, 5000);
}

/**
 * Render all notes from manager to the board
 */
export function renderAllNotes(noteManager) {
    const noteBoard = document.getElementById('note-board');
    noteBoard.innerHTML = '';

    noteManager.getAllNotes().forEach(note => {
        const noteElement = note.createElement();
        setupNoteEventListeners(noteElement, note, noteManager);
        noteBoard.appendChild(noteElement);
    });
}

/**
 * Render timestamp inside the note element
 */
function renderTimestamp(noteElement, timestamp) {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
        console.warn('Invalid timestamp:', timestamp);
        return;
    }

    const formatted = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    let timestampEl = noteElement.querySelector('.note-timestamp');
    if (!timestampEl) {
        timestampEl = document.createElement('div');
        timestampEl.className = 'note-timestamp';
        timestampEl.style.fontSize = '0.7em';
        timestampEl.style.color = '#666';
        timestampEl.style.marginTop = '4px';
        timestampEl.style.textAlign = 'right';
        noteElement.appendChild(timestampEl);
    }

    timestampEl.textContent = formatted;
}

/**
 * Sort notes by timestamp and re-render board
 */
function sortNotesByTimestamp(noteManager, order = 'asc') {
    const notes = noteManager.getAllNotes();

    notes.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return order === 'asc' ? dateA - dateB : dateB - dateA;
    });

    const noteBoard = document.getElementById('note-board');
    noteBoard.innerHTML = '';

    // Vertically position sorted notes
    let offsetY = 20;
    const spacingY = 160;
    const startX = 20;

    notes.forEach(note => {
        note.updatePosition(startX, offsetY);

        const noteElement = note.createElement();
        setupNoteEventListeners(noteElement, note, noteManager);
        noteElement.style.position = 'absolute';
        noteElement.style.left = `${note.x}px`;
        noteElement.style.top = `${note.y}px`;

        noteBoard.appendChild(noteElement);
        renderTimestamp(noteElement, note.createdAt);

        offsetY += spacingY;
    });
}
