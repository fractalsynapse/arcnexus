import type { Rule } from 'eslint';

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
      if (comment?.type !== 'Block' || !comment.value.startsWith('*')) {
        context.report({ node, messageId: 'missing' });
      }
    }

    return { ClassDeclaration: check, ClassExpression: check, MethodDefinition: check };
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
