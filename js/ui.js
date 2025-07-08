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

    // Double click on board to create a new note
    noteBoard.addEventListener('dblclick', (event) => {
        // Only create note if we clicked directly on the board, not on an existing note
        if (event.target === noteBoard) {
            createNewNote(event.clientX, event.clientY, noteManager);
        }
    });

    // Export button click handler
    exportBtn.addEventListener('click', () => {
        exportNotes(noteManager);
    });

    // Sort ascending button click handler
    sortAscBtn.addEventListener('click', () => {
        sortNotesByTimestamp(noteManager, 'asc');
    });

    // Sort descending button click handler
    sortDescBtn.addEventListener('click', () => {
        sortNotesByTimestamp(noteManager, 'desc');
    });

    // Setup auto-save timer
    setupAutoSave(noteManager);
}

/**
 * Create a new note at the specified position
 * @param {number} x - X position for the new note
 * @param {number} y - Y position for the new note
 * @param {NoteManager} noteManager - The note manager instance
 */
export function createNewNote(x, y, noteManager) {
    // Calculate position relative to the board
    const noteBoard = document.getElementById('note-board');
    const boardRect = noteBoard.getBoundingClientRect();
    
    const boardX = x - boardRect.left;
    const boardY = y - boardRect.top;

    // Create timestamp string for new note creation
    const timestamp = new Date().toISOString(); // ISO format (e.g. 2025-07-09T14:37:00.000Z)

    // Create the new note with empty content and no image, but with timestamp
    const note = createNote({
        content: '',
        x: boardX,
        y: boardY,
        timestamp,      // Add timestamp property here
        imageDataUrl: '' // Initialize empty image data
    });
    
    // Add to manager
    noteManager.addNote(note);
    
    // Create DOM element
    const noteElement = note.createElement();
    
    // Add event listeners to the note, including image upload and timestamp display
    setupNoteEventListeners(noteElement, note, noteManager);
    
    // Add to board
    noteBoard.appendChild(noteElement);
    
    // Focus the content area for immediate editing
    const contentElement = noteElement.querySelector('.note-content');
    contentElement.focus();
    
    // Render timestamp inside note
    renderTimestamp(noteElement, timestamp);

    return note;
}

/**
 * Set up event listeners for a note element
 * @param {HTMLElement} noteElement - The note DOM element
 * @param {Note} note - The note object
 * @param {NoteManager} noteManager - The note manager instance
 */
export function setupNoteEventListeners(noteElement, note, noteManager) {
    // Get elements
    const contentElement = noteElement.querySelector('.note-content');
    const deleteButton = noteElement.querySelector('.delete-btn');
    const quoteButton = noteElement.querySelector('.quote-btn');
    const imageUploadBtn = noteElement.querySelector('.image-upload-btn');
    const imageInput = noteElement.querySelector('.image-input');
    const imagePreview = noteElement.querySelector('.note-image');

    // Track whether the note is being dragged
    let isDragging = false;
    let dragOffsetX, dragOffsetY;

    // Display the note's image if it exists (for loaded notes)
    if (note.imageDataUrl) {
        imagePreview.src = note.imageDataUrl;
        imagePreview.style.display = 'block';
    } else {
        imagePreview.style.display = 'none';
    }
    
    // Display timestamp if it exists
    if (note.timestamp) {
        renderTimestamp(noteElement, note.timestamp);
    }

    // Content change handler
    contentElement.addEventListener('input', () => {
        note.updateContent(contentElement.textContent);
    });
    
    // Delete button handler
    deleteButton.addEventListener('click', () => {
        deleteNote(noteElement, note, noteManager);
    });
    
    // Quote button handler
    quoteButton.addEventListener('click', async () => {
        try {
            quoteButton.textContent = '⌛'; // Show loading indicator
            await note.addRandomQuote();
            quoteButton.textContent = '💡'; // Restore original icon
        } catch (error) {
            // Show error indicator briefly
            quoteButton.textContent = '❌';
            setTimeout(() => {
                quoteButton.textContent = '💡';
            }, 1500);
            
            // Display error in console
            console.error('Failed to fetch quote:', error);
        }
    });

    // Image upload button click handler
    imageUploadBtn.addEventListener('click', () => {
        imageInput.click(); // Trigger hidden file input click
    });

    // Handle image file selection
    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;

                // Set image preview and show it
                imagePreview.src = dataUrl;
                imagePreview.style.display = 'block';

                // Save the image data URL in the note object
                note.imageDataUrl = dataUrl;

                // Optionally, update the note's content or save state immediately
                // We'll rely on auto-save interval
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Drag start
    noteElement.addEventListener('mousedown', (event) => {
        // Ignore if clicking on buttons or content area
        if (event.target === deleteButton || 
            event.target === quoteButton ||
            event.target === contentElement ||
            event.target === imageUploadBtn ||
            event.target === imageInput ||
            event.target === imagePreview) {
            return;
        }
        
        // Start dragging
        isDragging = true;
        
        // Calculate offset from note's top-left corner
        const noteRect = noteElement.getBoundingClientRect();
        dragOffsetX = event.clientX - noteRect.left;
        dragOffsetY = event.clientY - noteRect.top;
        
        // Add active class for styling
        noteElement.classList.add('note-active');
        
        // Prevent text selection during drag
        event.preventDefault();
    });
    
    // Drag move
    document.addEventListener('mousemove', (event) => {
        if (!isDragging) return;
        
        // Get board position and dimensions
        const noteBoard = document.getElementById('note-board');
        const boardRect = noteBoard.getBoundingClientRect();
        
        // Calculate new position relative to board
        let newX = event.clientX - boardRect.left - dragOffsetX;
        let newY = event.clientY - boardRect.top - dragOffsetY;
        
        // Keep note within board boundaries
        newX = Math.max(0, Math.min(newX, boardRect.width - noteElement.offsetWidth));
        newY = Math.max(0, Math.min(newY, boardRect.height - noteElement.offsetHeight));
        
        // Update note position
        note.updatePosition(newX, newY);
    });
    
    // Drag end
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            noteElement.classList.remove('note-active');
        }
    });
}

/**
 * Delete a note
 * @param {HTMLElement} noteElement - The note DOM element
 * @param {Note} note - The note object
 * @param {NoteManager} noteManager - The note manager instance
 */
export function deleteNote(noteElement, note, noteManager) {
    // Add fade-out animation
    noteElement.classList.add('note-fade-out');
    
    // Remove after animation completes
    noteElement.addEventListener('animationend', () => {
        // Remove from DOM
        noteElement.remove();
        
        // Remove from manager
        noteManager.removeNote(note.id);
    });
}

/**
 * Export all notes as JSON file
 * @param {NoteManager} noteManager - The note manager instance
 */
export function exportNotes(noteManager) {
    const notes = noteManager.toJSON();
    exportNotesAsJson(notes);
}

/**
 * Setup auto-save functionality
 * @param {NoteManager} noteManager - The note manager instance
 */
export function setupAutoSave(noteManager) {
    // Save every 5 seconds if there are changes
    setInterval(() => {
        const notes = noteManager.toJSON();
        saveNotes(notes);
    }, 5000);
}

/**
 * Render all notes from manager to the board
 * @param {NoteManager} noteManager - The note manager instance
 */
export function renderAllNotes(noteManager) {
    const noteBoard = document.getElementById('note-board');
    
    // Clear existing notes
    const existingNotes = noteBoard.querySelectorAll('.note');
    existingNotes.forEach(noteElement => {
        noteElement.remove();
    });
    
    // Render all notes
    noteManager.getAllNotes().forEach(note => {
        const noteElement = note.createElement();
        setupNoteEventListeners(noteElement, note, noteManager);
        noteBoard.appendChild(noteElement);
    });
}

/**
 * Render timestamp inside the note element
 * @param {HTMLElement} noteElement - The note DOM element
 * @param {string} timestamp - ISO timestamp string
 */
function renderTimestamp(noteElement, timestamp) {
    // Format timestamp for display (e.g. "2025-07-09 14:37")
    const date = new Date(timestamp);
    const formatted = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

    // Find or create timestamp display element
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
 * @param {NoteManager} noteManager - The note manager instance
 * @param {'asc'|'desc'} order - Sort order: ascending or descending
 */
function sortNotesByTimestamp(noteManager, order = 'asc') {
    // Get all notes as array
    const notes = noteManager.getAllNotes();

    // Sort by timestamp property (convert to Date)
    notes.sort((a, b) => {
        const dateA = new Date(a.timestamp || 0).getTime();
        const dateB = new Date(b.timestamp || 0).getTime();
        return order === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // Clear and re-render notes in sorted order
    const noteBoard = document.getElementById('note-board');
    noteBoard.innerHTML = ''; // Clear all notes DOM

    notes.forEach(note => {
        const noteElement = note.createElement();
        setupNoteEventListeners(noteElement, note, noteManager);
        noteBoard.appendChild(noteElement);
    });
}
