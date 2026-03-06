const prisma = require('./src/lib/prisma');

async function main() {
  try {
    console.log('Testing VoiceAgent model...\n');
    
    // Get all agents
    const agents = await prisma.voiceAgent.findMany();
    console.log('Total agents in database:', agents.length);
    console.log('Agents:', JSON.stringify(agents, null, 2));
    
    // Get agents by tenant (if you know the tenantId)
    const tenants = await prisma.tenant.findMany({
      take: 1,
      select: { id: true, name: true }
    });
    
    if (tenants.length > 0) {
      const tenantId = tenants[0].id;
      console.log('\nTesting with tenant:', tenants[0].name, `(${tenantId})`);
      
      const tenantAgents = await prisma.voiceAgent.findMany({
        where: { tenantId }
      });
      
      console.log('Agents for this tenant:', tenantAgents.length);
      console.log('Agents:', JSON.stringify(tenantAgents, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
