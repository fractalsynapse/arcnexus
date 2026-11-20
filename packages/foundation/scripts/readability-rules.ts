import type { Rule } from 'eslint';

/** Describe ESLint's installed language hook missing from its SourceCode declarations. */
type InlineConfigurationSource = Rule.RuleContext['sourceCode'] & {
  getInlineConfigNodes(): ReturnType<Rule.RuleContext['sourceCode']['getAllComments']>;
};

export const noInlineConfiguration: Rule.RuleModule = {
  meta: {
    messages: { forbidden: 'Configure ESLint rules centrally; inline directives are forbidden.' },
  },
  /** Reject configuration comments as errors independently of CLI warning thresholds. */
  create(context) {
    return {
      /** Inspect actual comments so ordinary prose and source strings remain valid. */
      Program() {
        const source = context.sourceCode as InlineConfigurationSource;
        for (const comment of source.getInlineConfigNodes())
          context.report({ loc: comment.loc!, messageId: 'forbidden' });
      },
    };
  },
};

export const documentation: Rule.RuleModule = {
  meta: { messages: { missing: 'Add a documentation header explaining purpose and effects.' } },
  /** Require headers for classes and methods, including constructors. */
  create(context) {
    /** Inspect the declaration or its enclosing export for the header. */
    function check(node: Rule.Node) {
      const parent = node.parent;
      const declaration =
        parent?.type === 'ExportNamedDeclaration' || parent?.type === 'ExportDefaultDeclaration'
          ? parent
          : node;
      const comment = context.sourceCode.getCommentsBefore(declaration).at(-1);
      const content = comment?.value
        .replace(/^\*/, '')
        .replace(/^\s*\*(?:\s*\*)*\s?/gm, '')
        .trim();
      if (comment?.type !== 'Block' || !comment.value.startsWith('*') || !content) {
        context.report({ node, messageId: 'missing' });
      }
    }

    return {
      ClassDeclaration: check,
      ClassExpression: check,
      MethodDefinition: check,
      TSAbstractMethodDefinition: check,
    };
  },
};

export const spacing: Rule.RuleModule = {
  meta: { messages: { missing: 'Separate methods with a blank line.' } },
  /** Require separation when a method follows another class member. */
  create(context) {
    return {
      /** Include the method's documentation when measuring spacing. */
      ClassBody(node) {
        for (const [i, member] of node.body.entries()) {
          const previous = node.body[i - 1];
          if (!previous || member.type !== 'MethodDefinition') continue;
          const first = context.sourceCode.getCommentsBefore(member)[0] ?? member;
          if (previous.loc && first.loc && first.loc.start.line - previous.loc.end.line < 2) {
            context.report({ node: member, messageId: 'missing' });
          }
        }
      },
    };
  },
};
