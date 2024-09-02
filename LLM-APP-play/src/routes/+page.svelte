<script lang="ts">
	import { onMount } from 'svelte';
	import { Ollama } from '@langchain/ollama';
	import { PromptTemplate } from '@langchain/core/prompts';
	import { StringOutputParser } from '@langchain/core/output_parsers';
	import retriever from '$lib/retriever';
	import { combineDocuments } from '$lib/combineDocuments';
	import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
	import { formatConvHistory } from '$lib/formatConvHistory';
	// Initialize the model with the "llama3" configuration
	const model = new Ollama({ model: 'llama3', temperature: 0, topP: 0.1 });

	// Templates
	const standaloneQuestionTemplate =
		'Given some conversation history (if any) and a question, convert the question to a standalone question. question: {question} conversation history: {conversation_history} standalone question:';
	const answerPromptTemplate =
		"You are a quote finder that can find quotes from a given context. You are given a question and a context, and you need to find the quotes from the context that answer the question. You can only answer the question if you have the context. If you do not have the context, Try to find the answer in the context. If the answer is not given in the context, find the answer in the conversation history if possible. you need to apologise and say that you do not know the answer.  Don't try to make up an answer. Then use the quotes to answer the question like you would if you were to write a standalone question, but here i want you to write a standalone answer. your output should include the quotes and the standalone answer. make it clear what is a quote and what is the answr. use the conversation history to help you better answer the questions and reply to the user. conversation history: {conversation_history} question: {question} context: {context} answer:";

	// Create prompts
	const standaloneQuestionPrompt = PromptTemplate.fromTemplate(standaloneQuestionTemplate);
	const answerPrompt = PromptTemplate.fromTemplate(answerPromptTemplate);

	// Chains
	const standaloneQuestonChain = RunnableSequence.from([
		({ question, conversation_history }) => {
			messages = messages.slice(0, -1);
			messages = [...messages, { text: 'Processing standalone question...', type: 'ai' }];
			return { question, conversation_history };
		},
		standaloneQuestionPrompt,
		model,
		new StringOutputParser()
	]);

	const retrieverChain = RunnableSequence.from([
		(prevResult) => {
			if (!prevResult) throw new Error('prevResult is undefined');
			messages = messages.slice(0, -1);
			messages = [...messages, { text: 'Searching database...', type: 'ai' }];
			return prevResult.standalone_question;
		},
		retriever,
		combineDocuments
	]);
	const answerChain = answerPrompt.pipe(model).pipe(new StringOutputParser());
	const chain = RunnableSequence.from([
		{ standalone_question: standaloneQuestonChain, orginal_input: new RunnablePassthrough() },
		{ context: retrieverChain, question: ({ orginal_input }) => orginal_input.question, conversation_history: ({ orginal_input }) => orginal_input.conversation_history },
		async (input) => {
			messages = messages.slice(0, -1);
			messages = [...messages, { text: 'Formulating answer...', type: 'ai' }];
			return answerChain.invoke(input);
		}
	]);

	// Reactive variable to store conversation messages
	let messages: { text: string; type: 'human' | 'ai' }[] = [];

	// Function to progress the conversation
	async function progressConversation() {
		const userInput = document.getElementById('user-input') as HTMLInputElement;
		const question = userInput.value;
		userInput.value = '';

		// Add human message
		messages = [...messages, { text: question, type: 'human' }];

		// Add initial status message
		messages = [...messages, { text: 'Processing standalone question...', type: 'ai' }];

		try {
			// Process the chain
			const response = await chain.invoke({ question, conversation_history: formatConvHistory(messages) });
			messages = messages.slice(0, -1);

			// Add AI message
			messages = [...messages, { text: response, type: 'ai' }];
		} catch (error) {
			console.error('Error invoking chain:', error);
			// Remove last status message
			messages = messages.slice(0, -1);
		}
	}

	// Ensure the function is called correctly on button click
	onMount(() => {
		const submitBtn = document.getElementById('submit-btn');
		if (submitBtn) {
			submitBtn.addEventListener('click', (e) => {
				e.preventDefault();
				progressConversation();
			});
		}
	});
</script>

<main>
	<section class="chatbot-container">
		<div class="chatbot-header">
			<p class="sub-heading">Knowledge Bank</p>
		</div>
		<div class="chatbot-conversation-container" id="chatbot-conversation-container">
			{#each messages as { text, type }}
				<div class="speech {type === 'human' ? 'speech-human' : 'speech-ai'}">{text}</div>
			{/each}
		</div>
		<form id="form" class="chatbot-input-container">
			<input name="user-input" type="text" id="user-input" required />
			<button id="submit-btn" class="submit-btn">send</button>
		</form>
	</section>
</main>

<style>
	:root {
		--border-rad-lg: 15px;
		--light-text: #fefefe;
		margin: 0;
		padding: 0;
		font-family: 'Poppins';
	}

	*,
	*::before,
	*::after {
		box-sizing: border-box;
	}

	main {
		background-color: slategrey;
		background-size: cover;
		background-repeat: no-repeat;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.chatbot-container {
		background-color: #171f26;
		width: 360px;
		min-height: 380px;
		border-radius: var(--border-rad-lg);
		padding: 1em;
	}

	.chatbot-container > * {
		padding: 0.5em;
	}

	.chatbot-header {
		display: flex;
		flex-direction: column;
		gap: 0.6em;
	}

	.chatbot-conversation-container {
		height: 250px;
		overflow-y: scroll;
		margin: 1em 0;
	}

	.chatbot-conversation-container::-webkit-scrollbar,
	.chatbot-conversation-container::-moz-scrollbar {
		display: none;
	}

	.speech {
		padding: 1em;
		max-width: 240px;
		color: var(--light-text);
		min-width: 90%;
		border-radius: var(--border-rad-lg);
		font-size: 1.07em;
	}

	.speech:first-child {
		margin-top: 0;
	}

	.speech-ai {
		background: #334959;
		border-top-left-radius: 0;
		margin: 1.2em 1em 0 0;
	}

	.speech-human {
		margin: 1.2em 0 0 1em;
		background: #2f4f4f;
		border-top-right-radius: 0;
	}

	.chatbot-input-container {
		display: flex;
	}

	input[type='text'],
	button {
		background-color: transparent;
		border: 1px solid #586e88;
		border-radius: var(--border-rad-lg);
		padding: 1em;
	}

	input[type='text'] {
		color: var(--light-text);
		width: 100%;
		border-right: 0;
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}

	button {
		border-left: 0;
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}

	.sub-heading {
		color: #999999;
		font-family: 'Roboto', sans-serif;
		font-size: 12px;
		text-transform: uppercase;
		margin: 0;
	}
</style>
